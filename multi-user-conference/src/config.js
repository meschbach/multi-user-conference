import EventEmitter from "eventemitter3";
import {Future} from "junk-bucket/future";

export const ConfigState = Object.freeze({
	Initial: Symbol("initial"),
	Loading: Symbol("Loading"),
	Loaded: Symbol("Loaded"),
	Failed: Symbol("Failed")
});

export class ConfigLoader extends EventEmitter{
	constructor() {
		super();
		this.state = ConfigState.Initial;
		this._config = new Future();
	}

	load() {
		if( this.state !== ConfigState.Initial ){ return; }
		this._updateState(ConfigState.Loading);
		this._startLoading().then(() => {

		}, (e) => {
			console.error("Failed to load configuration", e);
			this._updateState(ConfigState.Failed);
		});
	}

	config() {
		if( this.state === ConfigState.Initial ){ this.load(); }
		return this._config.promised;
	}

	async _startLoading() {
		const configResponse = await fetch("/config/config.json");
		const config = await configResponse.json();
		this._config.accept(config);
		this._updateState(ConfigState.Loaded);
	}

	_updateState(newState){
		const old = this.state;
		this.state = newState;
		this.emit("state", {state: {from: old, to: newState}, source:this});
	}
}
