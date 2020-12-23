const EventEmitter = require("eventemitter3");
const WebSocket = require('ws');
const {Future} = require("junk-bucket/future");
const {promiseEventWithin} = require("muc-common/junk");
const {traceOp,traceError} = require("muc-common/trace");
const opentracing = require("opentracing");

const Chat = {
	Whisper: "chat.whisper"
}

const RoomEvents = {
	ChatBroadcast: Symbol("room.chat.broadcast")
}

const Connection = {
	OnChange: Symbol("connection.change"),
	Disconnected: Symbol("disconnected"),
	Connecting: Symbol("connecting"),
	Connected: Symbol("connected")
};

class MultiUserConferenceClient extends EventEmitter {
	constructor(tracer) {
		super();
		this.tracer = tracer;
		this.connectionState = Connection.Disconnected;
	}

	_updateConnection(newState, oldState){
		if( this.connectionState !== oldState ){
			throw new Error("Wrong state...got " + this.connectionState + " wanted " + oldState);
		}
		this.connectionState = newState;
		this.emit(Connection.OnChange, {source: this, from: oldState, to: newState});
	}

	async connect( url, parentSpan, WebSocketClient = WebSocket ) {
		//TOOD: Probably need a websocket factory to avoid the node/browser split
		if( this.wsConnection ){
			throw Error("Already connected");
		}
		this._updateConnection(Connection.Connecting, Connection.Disconnected);
		const span = this.tracer.startSpan("muc.client.ws.connect", {childOf: parentSpan, tags: {url}});
		try {
			const headers = {};
			this.tracer.inject(span, opentracing.FORMAT_HTTP_HEADERS, headers);
			this.wsConnection = new WebSocketClient(url, ["muc/v1"],{headers});
			this.wsConnection.on("message", (rawFrame) => {
				const message = JSON.parse(rawFrame);
				const parentContext = this.tracer.extract( opentracing.FORMAT_TEXT_MAP, message.trace );
				const messageSpan = this.tracer.startSpan("muc.client.ws.onMessage", {childOf: parentContext});
				messageSpan.setTag("action", message.action);
				try {
					this._ingest(message, messageSpan);
					messageSpan.log({event: "message processed"});
				}catch(e){
					traceError(messageSpan, e);
				}finally{
					messageSpan.finish();
				}
			});
			await promiseEventWithin(this.wsConnection, "open", 1 * 1000);
			this._updateConnection(Connection.Connected, Connection.Connecting);
			span.log({event: "socket open"});
		}finally {
			span.finish();
		}
	}

	async connectFromBrowser( url, parentSpan, WebSocketClient ){
		//TOOD: Probably need a websocket factory to avoid the node/browser split
		if( this.wsConnection ){
			throw Error("Already connected");
		}
		this._updateConnection(Connection.Connecting, Connection.Disconnected);
		const span = this.tracer.startSpan("muc.client.ws.connect", {childOf: parentSpan, tags: {url}});
		try {
			this.wsConnection = new WebSocketClient(url);
			this.wsConnection.addEventListener("message", (event) => {
				const message = JSON.parse(event.data);
				const parentContext = this.tracer.extract( opentracing.FORMAT_TEXT_MAP, message.trace );
				const messageSpan = this.tracer.startSpan("muc.client.ws.onMessage", {childOf: parentContext});
				messageSpan.setTag("action", message.action);
				try {
					this._ingest(message, messageSpan);
					messageSpan.log({event: "message processed"});
				}catch(e){
					traceError(messageSpan, e);
				}finally{
					messageSpan.finish();
				}
			});
			const promise = new Future();
			setTimeout(() => {
				if( !promise.resolved ){
					promise.reject("timed out")
				}
			}, 1 * 1000);
			this.wsConnection.onopen = () => {
				if( !promise.resolved ){
					promise.accept();
				}
			}
			await promise.promised;
			this._updateConnection(Connection.Connected, Connection.Connecting);
			span.log({event: "socket open"});
		}finally {
			span.finish();
		}
	}

	_ingest( message, span ){
		try {
			switch (message.action) {
				case "hello":
					this.emit("connected");
					break;
				case "log.in":
					this.emit("log.in", message);
					break;
				case "chat.whisper":
					this.emit(Chat.Whisper, message);
					break;
				case "chat.whisper.sent":
					this.emit("chat.whisper.sent", message);
					break;
				case "room.details":
					this.emit("room.details", message);
					break;
				case "room.exit":
					this.emit("room.exit", message);
					break;
				case "room.current":
					this.currentRoom = message.room;
					this.emit("room.current", message);
					break;
				case "room.chat.broadcast":
					this.emit(RoomEvents.ChatBroadcast, {what: message.what, from: message.from, span: span});
					break;
				default:
					throw new Error("no handler for message type: " + message.action);
			}
		}catch(e){
			traceError(span, e);
			console.error("muc.client._ingest",e);
		}
	}

	async register(userName, parentSpan) {
		if( !parentSpan ){ throw new Error("missing parent context"); }
		const span = this.tracer.startSpan("muc.client.ws.register", {childOf: parentSpan});
		try {
			this._send({action: "log.in", userName},span);
			const loginResponse = await promiseEventWithin(this, "log.in", 1 * 1000);
			if (!loginResponse.success) {
				throw new Error("failed to login: " + loginResponse.reason);
			}
			this.userName = userName;
			this.currentRoom = loginResponse.room;
			return loginResponse.sessionID;
		}catch(e){
			traceError(span,e);
			throw e;
		}finally {
			span.finish();
		}
	}

	async whisper(to, message, parentSpan) {
		const subspan = this.tracer.startSpan("muc.client.ws.whisper", {childOf: parentSpan});
		try {
			this._send({action: "chat.whisper", to, message}, subspan);
			const whisper = await promiseEventWithin(this, "chat.whisper.sent", 1 * 1000);
			if (!whisper.success) {
				throw new Error("failed to whisper: " + whisper.reason);
			}
			return whisper.id;
		}finally {
			subspan.finish();
		}
	}

	async loadRoom(id, parent){
		return await traceOp(async (span) => {
			this._send({action: "rooms.describe", room:id}, span);
			const op = await promiseEventWithin(this, "room.details", 1 * 1000);
			if (!op.success) {
				throw new Error("failed to whisper: " + op.reason);
			}
			return op.room;
		},"muc.client.ws.loadRoom", this.tracer, parent, {tags: {id}});
	}

	async exitRoom(direction, span){
		return await traceOp(async (span) => {
			this._send({action: "rooms.exit", direction}, span);
			const op = await promiseEventWithin(this, "room.exit", 1 * 1000);
			if (!op.success) {
				throw new Error("failed to exit: " + op.reason);
			}
			return op.room;
		}, "muc.client.ws.exitRoom", this.tracer, span, {tags: {direction}});
	}

	async sayInRoom( what, parentSpan ){
		return await traceOp(async (span) => {
			this._send({action: "room.say", what}, span);
		}, "muc.client.ws.room.say", this.tracer, parentSpan, {});
	}

	async _send(message, traceContext){
		if( !traceContext ){ throw new Error("tracing context required"); }
		message.trace = {}
		this.tracer.inject(traceContext, opentracing.FORMAT_TEXT_MAP, message.trace);
		this.wsConnection.send(JSON.stringify(message));
	}

	async end(){
		this.wsConnection.end();
		this.wsConnection.close();
	}
}

module.exports = {
	MultiUserConferenceClient,
	Chat,
	RoomEvents,
	Connection
}
