import {MultiUserConferenceClient} from "muc-client/client";
import EventEmitter from "eventemitter3";

class BrowserSpan {
	log() {}
	setTag(name,value){}
	finish() {

	}
}

function newBrowserTracer(){
	return {
		startSpan: () => new BrowserSpan(),
		extract: () => new BrowserSpan(),
		inject: () => {}
	};
}

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
		this.client = new MultiUserConferenceClient(tracer);
		this.state = States.Initial;
		this.output = [];
		this.isAuthenticated = false;
	}

	_updateState(state){
		const oldState = this.state;
		this.state = state;
		this.emit(States.OnChange, {source:this, from: oldState, to: state});
	}

	digest() {
		switch (this.state){
			case States.Initial:
				this.client.connectFromBrowser("ws://localhost:9400", null, WebSocket).then((result) => {
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
		const span = new BrowserSpan();
		const tokens = input.split(" ");
		if( tokens.length === 0 ){ return; }
		switch (tokens[0]){
			case "go":
				const roomID = await this.client.exitRoom(tokens[1], span);
				const room = await this.client.loadRoom(roomID, span);
				this.emit(States.NewRoom, room);
				break;
			default:
				this.emit(States.Error, {source:this, message: "Unknown command: "+ tokens[0]});
		}
	}

	async doAuthenticate(userName){
		try {
			await this.client.register(userName);
			this._updateState(States.Authenticated);
			this.isAuthenticated = true;
			const room = await this.client.loadRoom(this.client.currentRoom, new BrowserSpan());
			this.emit(States.NewRoom, room);
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

export function newGameState(){
	const tracer = newBrowserTracer();
	return new ClientState(tracer);
}
