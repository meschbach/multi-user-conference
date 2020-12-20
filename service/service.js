const WebSocket = require('ws');
const {Future, promiseEvent, delay} = require("junk-bucket/future");
const {traceError, opentracing} = require("./tracing");
const EventEmitter = require("events");

async function traceSpan(fn, name, options, tracer, parent){
	options.childOf = parent;
	const span = tracer.startSpan(name, options);
	try {
		return await fn(span);
	}catch (e){
		traceError(span,e);
	}finally {
		span.finish();
	}
}

class MultiUserConferenceServer {
	constructor(tracer) {
		this.tracer = tracer;
		this.coordinator = new MUCCoordinator(tracer);
	}

	async startInProcess(port = 0) {
		const wss = new WebSocket.Server({
			port
		});
		wss.on("connection", (client, req) => {
			const tracingContext = this.tracer.extract( opentracing.FORMAT_HTTP_HEADERS, req.headers );
			traceSpan(async (span) => {
				await this._newClient(client,span);
			},"muc.server.ws.onConnection", {}, this.tracer, tracingContext);
		});
		this.serverSocket = wss;
		await promiseEvent(wss, "listening");
		const actualPort = wss.address().port;
		return "http://localhost:" + actualPort;
	}

	end() {
		this.serverSocket.clients.forEach((c) => c.close());
		this.serverSocket.close();
	}

	async _newClient(clientWebSocket, span){
		new MUCServiceConnection(clientWebSocket, this.coordinator, this.tracer, span);
	}
}

class MUCCoordinator {
	constructor(tracer) {
		this.users = {}
		this.rooms = new RoomsService(tracer);
	}

	exists(user){
		return !!users[user];
	}

	register(user, port){
		if( this.users[user] ){
			return false;
		} else {
			this.users[user] = port;
			return true;
		}
	}

	findUser( user ){
		return this.users[user];
	}
}

const RoomEvents = {
	ChatBroadcast: Symbol("room.chat.broadcast")
}

class LoadedRoom extends EventEmitter{
	constructor({name,description,exits}) {
		super();
		this.name = name;
		this.description = description;
		this.exits = exits;
	}

	async broadcastChat(client, what, span){
		const userName = client.userName;
		if( !userName ){
			throw new Error("client has not authenticated");
		}
		this.emit(RoomEvents.ChatBroadcast, {
			from: userName,
			what,
			room: this,
			span
		});
	}
}

class RoomsService {
	constructor(tracer) {
		this.tracer = tracer;
		this.startRoom = 0;
		this.rooms = [
			new LoadedRoom({name: "Foyer", description:"You are at the entrance of the conference complex", exits: {in: 1}}),
			new LoadedRoom({name: "Lobby", description: "It's a lobby.  Peeps milling about", exits: {out: 0}})
		];
	}

	async load( id, parentSpan ){
		if( !parentSpan ){
			throw new Error("Context expected");
		}
		return await traceSpan(async (span) => {
			if( id === undefined ){ throw new Error("bad id"); }
			const room = this.rooms[id];
			if( !room ){
				throw new Error("No such room " + id);
			}
			return room;
		}, "muc.service.rooms.load", {tags: {roomID: id}}, this.tracer, parentSpan);
	}
}

class MUCServiceConnection {
	constructor(socket, coordinator, tracer, initSpan) {
		this.tracer = tracer;
		this.socket = socket;
		this.coordinator = coordinator;
		this.socket.on("message", (frame) => this._ingest(frame));
		this._send({action:"hello", version:0}, initSpan);
	}

	async _ingest(rawFrame){
		const onRoomChatBroadcast = ({from,what, room, span}) => {
			if( this.currentRoom.id === room.id ){
				this._send({action: "room.chat.broadcast", from: from.userName, what}, span);
			} else {
				span.log({event: "not in room", user: this.userName, fromRoom: room.id, currentRoom: this.currentRoom.id});
			}
		}
		const onChangeRoom = async (roomID, span) => {
			if( this.currentRoom ) {
				this.currentRoom.off(RoomEvents.ChatBroadcast, onRoomChatBroadcast);
			}
			const newRoom = await this.coordinator.rooms.load(roomID, span);
			newRoom.on(RoomEvents.ChatBroadcast, onRoomChatBroadcast);
			this.currentRoom = newRoom;
			this._send({action: "room.current", room: newRoom}, span);
		}

		const message = JSON.parse(rawFrame);
		const tracingContext = this.tracer.extract( opentracing.FORMAT_TEXT_MAP, message.trace );
		const span = this.tracer.startSpan("muc.server.ws:" + message.action, {childOf: tracingContext});
		try {
			switch (message.action) {
				case "log.in":
					const success = this.coordinator.register(message.userName, this);
					if (success) {
						this.userName = message.userName;
						await onChangeRoom(this.coordinator.rooms.startRoom, span);
						this._send({action: "log.in", success: true, room: 0}, span);
					} else {
						this._send({action: "log.in", success: false, reason: "already taken"}, span);
					}
					break;
				case "rooms.describe":
					span.log({"event" : "describe", message});
					const id = message.room;
					const room = await this.coordinator.rooms.load(id, span);
					if( room ){
						const {name,description} = room;
						const exits = Object.keys(room.exits);
						this._send({action:"room.details", success:true, room: {id,name,description, exits}}, span);
					} else {
						this._send({action:"room.details", success:false, reason: "no such room " + id}, span);
					}
 					break;
				case "room.say":
					span.log({"event" : "room.say"});
					if( !this.currentRoom ){
						span.log({"event": "no current room"});
						this._send({action: "client.error", message: "not in a room"}, span);
						return;
					}
					const what = message.what;
					await this.currentRoom.broadcastChat(this, what, span);
					break;
				case "rooms.exit":
					this._roomExit(message,span, onChangeRoom);
					break;
				case "chat.whisper":
					const {to, message: msg} = message;
					const user = this.coordinator.findUser(to);
					user.whispered(this.userName, msg, span);
					this._send({action: "chat.whisper.sent", success: true}, span);
					break;
				default:
					console.warn("Unknown client action: " + message.action);
			}
		} catch (e) {
			traceError(span,e);
			console.error("Failed to process message", e);
		} finally {
			span.finish();
		}
	}

	whispered(fromUser, message, span){
		this._send({action: "chat.whisper", message, fromUser}, span);
	}

	_send(msg, traceContext) {
		if(!traceContext === undefined){ throw new Error("no trace context"); }
		msg.trace = {};
		this.tracer.inject(traceContext, opentracing.FORMAT_TEXT_MAP, msg.trace);
		this.socket.send(JSON.stringify(msg));
	}

	async _roomExit(message,span, onRoomChange){
		span.log({"event" : "rooms.exit", message, currentRoom: this.currentRoom.id});
		const {direction} = message;
		const {exits} = this.currentRoom;
		const newRoom = exits[direction];
		if( newRoom !== undefined ){
			span.log({"event" : "rooms.moved", from: this.currentRoom.id, to: newRoom});
			await onRoomChange(newRoom, span);
			this._send({action: "room.exit", success: true, room: newRoom}, span);
		} else {
			span.log({"event" : "failed", from: this.currentRoom, direction: direction});
			this._send({action: "room.exit", success: false, reason: "no such exit: " + direction}, span);
		}
	}
}

module.exports = {
	MultiUserConferenceServer
}
