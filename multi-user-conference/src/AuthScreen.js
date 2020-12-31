import React, {useState, useRef} from "react";
import './AuthScreen.css';
import EventEmitter from "eventemitter3";
import {useWatchedValue} from "./junk";

const States = Object.freeze({
	Init: Symbol("init"),
	Authenticating: Symbol("authenticating"),
	LoggedIn: Symbol("logged-in"),

	Registering: Symbol("registering")
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

	//TODO: Dry with the following two methods
	authenticate(alias, secret){
		const span = this.controller.tracer.startSpan("Authenticator.authenticate");
		this.updateState(States.Authenticating);
		this.controller.doAuthenticate(alias, secret, span).then((result) => {
			if( result.ok ){
				this.updateState(States.LoggedIn);
			} else {
				span.log({event:"failed", result});
				this.error = result.reason;
				this.updateState(States.Init);
			}
			span.finish();
		}, (e) => {
			console.error("Exceptional condition", e);
			this.error = e.toString();
			this.updateState(States.Init);
			span.finish();
		});
	}

	register(alias, secret){
		this.updateState(States.Registering);
		this.controller.doRegister(alias,secret).then((result) => {
			if( result.ok ){
				this.updateState(States.LoggedIn);
			} else {
				this.error = result.error;
				this.updateState(States.Init);
			}
		}, (e) => {
			console.error("Exceptional condition", e);
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
	const onRegister = (alias, secret) => {
		mediator.register(alias, secret);
	};

	return (<AuthenticationView mediator={mediator} attemptLogin={(alias,secret) => mediator.authenticate(alias,secret)} onRegister={onRegister}/>);
}

function AuthenticationView({mediator, attemptLogin, onRegister}){
	const state = useWatchedValue(mediator, Events.Changed, (m) => m.state);
	const error = useWatchedValue(mediator, Events.Changed, (m) => m.error);

	return (<div className='auth-screen'>
		<h3>Log In</h3>
		<div>
			{error && <div>{error}</div>}
			{state === States.Init && <InputPrompt onTry={attemptLogin} onRegister={onRegister}/>}
			{state === States.Authenticating && <div>Authenticating</div>}
			{state === States.LoggedIn && <div>Authenticated</div>}
		</div>
	</div>);
}

function InputPrompt({onTry, onRegister}){
	const [name,setName] = useState("");
	const [password, setPassword] = useState("");
	const nameRef = useRef(null);
	const passwordRef = useRef(null);

	const updateName = (e) => {
		setName(e.target.value);
	};
	const updatePassword = (e) => {
		setPassword(e.target.value);
	}

	//TODO: DRY
	const login = () => {
		if( name.trim() === "" ) {
			nameRef.current.focus();
		} else if(password.trim() === "" ){
			passwordRef.current.focus();
		} else {
			onTry(name, password);
		}
	}
	const register = () => {
		if( name.trim() === "" ) {
			nameRef.current.focus();
		} else if(password.trim() === "" ){
			passwordRef.current.focus();
		} else {
			onRegister(name, password);
		}
	}

	const submitForm = (e) => {
		e.preventDefault();
		login();
	}

	return (<div>
		<form onSubmit={submitForm}>
			<p>Alias <input onChange={updateName} ref={nameRef}/></p>
			<p>Secret <input type='password' onChange={updatePassword} ref={passwordRef}/></p>
			<p><button onClick={login}>Sign in</button></p>
			<p><button onClick={register}>Register</button></p>
		</form>
	</div>);
}
