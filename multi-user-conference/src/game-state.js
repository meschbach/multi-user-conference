import {MultiUserConferenceClient} from "muc-client/client";
import EventEmitter from "eventemitter3";
import {traceError} from "muc-common/trace";

export const States = {
	//Events
	OnChange: Symbol("muc.spa.on-change"),
	NewRoom: Symbol("muc.spa.new-room"),
	Error: Symbol("muc.spa.error"),

	//Core Events
	Initial: Symbol("muc.spa.initial"),
	Starting: Symbol("muc.spa.starting"),
	PreAuth: Symbol("muc.spa.pre-auth"),
	Authenticating: Symbol("muc.spa.authenticating"),
	Authenticated: Symbol("muc.spa.authenticated"),
	Online: Symbol("muc.spa.online")
};

class ClientState extends EventEmitter {
	constructor(tracer) {
		super();
		this.tracer = tracer;
		this.client = new MultiUserConferenceClient(tracer);
		this.client.on("room.current", ({room}) => {
			console.log("Room changed", room);
			this._updateRoom(room);
		});
		this.state = States.Initial;
		this.output = [];
		this.isAuthenticated = false;
	}

	_updateState(state){
		const oldState = this.state;
		this.state = state;
		this.emit(States.OnChange, {source:this, from: oldState, to: state});
	}

	digest(parentSpan) {
		switch (this.state){
			case States.Initial:
				this.client.connectFromBrowser("ws://localhost:9400", parentSpan, WebSocket).then((result) => {
					this._updateState(States.PreAuth);
				}, (e) => {
					console.error(e);
				});
				this._updateState(States.Starting);
				break;
			case States.Authenticated:
			case States.Online:
			case States.Starting:
			case States.PreAuth:
			case States.Authenticating:
				break;
			default:
				throw new Error("shouldn't get here --> " + this.state.toString());
		}
	}

	input(value){
		switch (this.state){
			case States.PreAuth:
				this.doAuthenticate(value);
				this._updateState(States.Authenticating);
				break;
			case States.Online:
				this._interpretCommand(value).then(() => {}, (e) => {
					console.error("Failed to interpret command", e);
					this.emit(States.Error,{source: this, message: e.message});
				});
				break;
			default:
				console.warn("input not wanted");
		}
	}

	async _interpretCommand(input){
		const span = this.tracer.startSpan("game-state._interpretCommand");
		try {
			const tokens = input.split(" ");
			if( tokens.length === 0 ){ return; }
			switch (tokens[0]){
				case "go":
					await this.client.exitRoom(tokens[1], span);
					break;
				case "say":
					const whatToSay = input.substr(tokens[0].length + 1);
					await this.client.sayInRoom( whatToSay, span);
					break;
				default:
					this.emit(States.Error, {source:this, message: "Unknown command: "+ tokens[0]});
			}
		}catch(e){
			traceError(span,e);
			throw e;
		}finally {
			span.finish();
		}
	}

	_updateRoom(room){
		console.log("Current room", room);
		this.currentRoom = room;
		this.emit(States.NewRoom, room);
	}

	async doAuthenticate(alias,secret, parentSpan){
		const span = this.tracer.startSpan("game-state.doAuthenticate", {childOf: parentSpan});
		try {
			const result = await this.client.login(alias, secret, span);
			const {ok,session, reason} = result;
			if (!ok){
				this.isAuthenticated = false;
				span.log({event: "failed-auth", error: reason});
				this.emit(States.Error, {source:this, message: reason});
				this._updateState(States.PreAuth);
				return {ok: false, error:reason};
			}

			this._updateState(States.Authenticated);
			this.isAuthenticated = true;
			this._updateState(States.Online);
			return {ok: true};
		}catch(e){
			this.isAuthenticated = false;
			this.emit(States.Error, {source:this, message: e.message});
			this._updateState(States.PreAuth);
			span.log({event: "error", message: e.message});
			return {ok: false, error: e.message};
		}finally {
			span.finish();
		}
	}

	async doRegister( alias, secret ){
		const span = this.tracer.startSpan("game-state.doRegister");
		try {
			const session = await this.client.register(alias, secret, span);
			this._updateState(States.Authenticated);
			this.isAuthenticated = true;
			this._updateState(States.Online);
			return {ok: true};
		}catch(e){
			this.isAuthenticated = false;
			this.emit(States.Error, {source:this, message: e.message});
			this._updateState(States.PreAuth);
			return {ok: false, error: e.message};
		}
	}
}

export function newGameState(tracer){
	return new ClientState(tracer);
}
