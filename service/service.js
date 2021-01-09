const WebSocket = require('ws');
const {Future, promiseEvent, delay} = require("junk-bucket/future");
const {traceError, opentracing} = require("./tracing");
const EventEmitter = require("events");
const url = require("url");

const {traceOp} = require("../common/trace");

const {RoomsService,RoomEvents} = require("./rooms");
const {serializeRoomDescription} = require("./room-serializers");

const {Disconnect} = require("./common");
const {setupWebsocketV1} = require("./ws-v1");

class MultiUserConferenceServer {
	constructor(tracer) {
		this.tracer = tracer;
		this.coordinator = new MUCCoordinator(tracer);
	}

	async startInProcess(port = 0, host = "localhost") {
		const wss = new WebSocket.Server({
			host,
			port
		});
		wss.on("connection", (client, req) => {
			/**
			 * Browser web sockets do not allow us to pass in headers, so we're using query parameters
			 */
			let tracingContext;
			const queryObject = url.parse(req.url,true).query;
			//TODO: DRY
			if( queryObject["uber-trace-id"]) {
				tracingContext = this.tracer.extract( opentracing.FORMAT_HTTP_HEADERS, queryObject );
			} else {
				tracingContext = this.tracer.extract( opentracing.FORMAT_HTTP_HEADERS, req.headers );
			}
			traceOp(async (span) => {
				await this._newClient(client,span);
			},"muc.server.ws.onConnection", this.tracer, tracingContext, {});
		});
		this.serverSocket = wss;
		await promiseEvent(wss, "listening");
		const actualPort = wss.address().port;
		return "http://"+host+":" + actualPort;
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

	register(alias, secret, port, span){
		if( !alias || !secret || alias.trim().length < 3 || secret.trim().length < 3 ){
			span.log({event: "registration rejected", reason: "alias or secret was too short" });
			return false;
		}

		if( this.users[alias] ){
			span.log({event: "registration rejected", reason: "a user by that name already exists", alias });
			return false;
		} else {
			this.users[alias] = {
				secret,
				port
			};
			span.log({event: "reigstered", alias });
			return true;
		}
	}

	async login( alias, secret, port, span ){
		if( !alias || !secret || alias.trim().length < 3 || secret.trim().length < 3 ){
			span.log({event: "login rejected", reason: "alias or secret was too short" });
			return false;
		}
		span.log({event: "login-attempt", alias });
		const user = this.users[alias];
		if( user && user.secret === secret ){
			span.log({event: "login successful"});
			if( user.port ) {
				span.log({event: "existing connection"});
				await user.port.forceDisconnect(Disconnect.Login, span);
			}
			user.port = port;
			return true;
		} else {
			span.log({event: "login failed"});
			return false;
		}
	}

	findUser( user ){
		return this.users[user].port;
	}
}

class MUCServiceConnection {
	constructor(socket, coordinator, tracer, initSpan) {
		this.tracer = tracer;
		this.socket = socket;
		this.coordinator = coordinator;
		this.socket.on("message", (frame) => {
			try {
				this._ingest(frame).then(() => {}, (e) => {
					console.error("Need to trace -- error while consuming message frame",e);
				});
			}catch(e){
				console.error("Need to trace -- error while consuming message frame",e);
			}
		});
		this._send({action:"hello", version:0}, initSpan);
		this._incomingMessages = setupWebsocketV1();
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
			const {name,description,exits} = this.currentRoom;
			const serializedRoom = {name,description,exits};
			this._send({action: "room.current", room: serializedRoom}, span);
			return newRoom;
		}

		const message = JSON.parse(rawFrame);
		const tracingContext = this.tracer.extract( opentracing.FORMAT_TEXT_MAP, message.trace );
		const span = this.tracer.startSpan("muc.server.ws:" + message.action, {childOf: tracingContext});
		try {
			const action = message.action;
			switch (action) {
				case "user.register":
					await this._register(message, span, onChangeRoom);
					break;
				case "user.login":
					await this._login(message, span, onChangeRoom);
					break;
				case "rooms.describe":
					await this._describeRoom(message,span);
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
					await this._roomExit(message,span, onChangeRoom);
					break;
				default:
					const postActions = [];
					span.log({event: "pre-handler", action});
					const result = await this._incomingMessages.dispatch(action, message, {
						userName: this.userName,
						coordinator: this.coordinator,
						send: (message) => this._send(message,span),
						forceDisconnect: (reason) => postActions.push(() => this.forceDisconnect(reason,span)),

						//Deprecated
						span
					});
					span.log({event: "handler-complete", result});
					if( result ){
						this._send(result,span);
					}
					postActions.forEach((action) => action());
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
		traceContext.log({event: "muc.server.send", to: this.userName, message:msg});
		this.socket.send(JSON.stringify(msg));
	}

	async _roomExit(message,span, onRoomChange){
		span.log({"event" : "rooms.exit", message, currentRoom: this.currentRoom.id});
		const {direction} = message;
		const {exits} = this.currentRoom;
		const newRoomID = exits[direction];
		if( newRoomID !== undefined ){
			span.log({"event" : "rooms.moved", from: this.currentRoom.id, to: newRoomID});
			const newRoom = await onRoomChange(newRoomID, span);
			this._send({action: "room.exit", success: true, room: serializeRoomDescription(newRoom)}, span);
		} else {
			span.log({"event" : "failed", from: this.currentRoom, direction: direction});
			this._send({action: "room.exit", success: false, reason: "no such exit: " + direction}, span);
		}
	}

	//TODO: DRY these two methods
	async _register( message, span, onChangeRoom ){
		const {sharedSecret} = message;
		if( !sharedSecret ){
			this._send({action: "log.in", success: false, reason: "bad format"}, span);
			return;
		}
		const {alias,secret} = sharedSecret;
		const success = this.coordinator.register(alias, secret, this, span);
		if (success) {
			this.userName = alias;
			await onChangeRoom(this.coordinator.rooms.startRoom, span);
			this._send({action: "log.in", success: true, room: 0}, span);
		} else {
			this._send({action: "log.in", success: false, reason: "already taken"}, span);
		}
	}

	async _login( message, span, onChangeRoom  ){
		const {sharedSecret} = message;
		const {alias,secret} = sharedSecret;
		const result = await this.coordinator.login(alias, secret, this, span);
		if( result ){
			this.userName = alias;
			await onChangeRoom(this.coordinator.rooms.startRoom, span);
			this._send({action: "log.in", success: true, room: 0}, span);
		} else {
			const reason = "alias or secret wrong";
			span.log({event:"failed", reason});
			this._send({action: "log.in", success: false, reason}, span);
		}
	}

	async forceDisconnect( reason, span ){
		span.log({event: "force-disconnect", reason: reason.toString()});
		const serializedReasonForm = {
			[Disconnect.Login]: "login",
			[Disconnect.NotAuthenticated]: "not-authenticated"
		}
		const serializedForm = serializedReasonForm[reason];
		if( !serializedForm ){
			throw new Error("Unserializable value " + reason.toString());
		}

		this._send({action: "connection.disconnect", reason: serializedForm}, span);
		this.socket.close();
	}

	async _describeRoom(message,span){
		span.log({"event" : "describe", message});
		const id = message.room;
		if( !Number.isInteger(id) ){
			span.log({"event":"error", id});
			this._send({action:"room.details", success:false, reason: "bad id"}, span);
		}
		const room = await this.coordinator.rooms.load(id, span);
		if( room ){
			this._send({action:"room.details", success:true, room: serializeRoomDescription(room)}, span);
		} else {
			this._send({action:"room.details", success:false, reason: "no such room " + id}, span);
		}
	}
}

module.exports = {
	MultiUserConferenceServer
}
