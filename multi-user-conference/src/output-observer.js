import EventEmitter from "eventemitter3";
import {States} from "./game-state";

export class OutputObserver extends EventEmitter {
	constructor() {
		super();
		this.messages = [];
		this.id = 0;
	}

	_push(obj) {
		const change = Object.freeze(Object.assign({}, obj, {id: this.id++}))
		this.messages.unshift(change);
		this.emit("update");
	}

	watch( controller ) {
		controller.on(States.OnChange, ({from, to}) => {
			this._push({
				id: Date.now(), type: States.OnChange,
				from, to
			});
		});
		controller.on(States.NewRoom, (room) => {
			if( room === undefined ){
				console.error("Room is undefined, ignoring");
				return;
			}
			this._push({
				when: Date.now(), type: States.NewRoom,
				room
			});
		});
		controller.on(States.Error, ({message}) => {
			this._push({
				when: Date.now(), type: States.Error,
				message
			});
		});
	}
}
