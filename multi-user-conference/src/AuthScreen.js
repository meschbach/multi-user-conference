import React, {useState} from "react";
import './AuthScreen.css';
import EventEmitter from "eventemitter3";
import {useWatchedValue} from "./junk";

const States = Object.freeze({
	Init: Symbol("init"),
	Authenticating: Symbol("authenticating"),
	LoggedIn: Symbol("logged-in"),
});

const Events = Object.freeze({
	Changed: Symbol("state.changed")
});

class Authentiactor extends EventEmitter {
	constructor(controller) {
		super();
		this.controller = controller;
		this.state = States.Init;
	}

	authenticate(alias){
		this.updateState(States.Authenticating);
		this.controller.doAuthenticate(alias).then((result) => {
			if( result.ok ){
				this.updateState(States.LoggedIn);
			} else {
				this.error = result.error;
				this.updateState(States.Init);
			}
		}, (e) => {
			this.error = e.toString();
			this.updateState(States.Init);
		});
	}

	updateState(state) {
		this.state = state;
		this.emit(Events.Changed, state);
	}
}

export function AuthScreen({controller}) {
	if (!controller) {
		throw new Error("Controller null");
	}
	const [mediator] = useState(new Authentiactor(controller));

	return (<AuthenticationView mediator={mediator} attemptLogin={(alias) => mediator.authenticate(alias)}/>);
}

function AuthenticationView({mediator, attemptLogin}){
	const state = useWatchedValue(mediator, Events.Changed, (m) => m.state);
	const error = useWatchedValue(mediator, Events.Changed, (m) => m.error);

	return (<div className='auth-screen'>
		<h3>Log In</h3>
		<div>
			{error && <div>{error}</div>}
			{state === States.Init && <InputPrompt onTry={attemptLogin}/>}
			{state === States.Authenticating && <div>Authenticating</div>}
			{state === States.LoggedIn && <div>Authenticated</div>}
		</div>
	</div>);
}

function InputPrompt({onTry}){
	const [name,setName] = useState("");

	const updateName = (e) => {
		setName(e.target.value);
	};

	const dispatch = () => {
		onTry(name);
	}

	return (<div>
		<input onChange={updateName}/>
		<button onClick={dispatch}>Sign in</button>
	</div>);
}
