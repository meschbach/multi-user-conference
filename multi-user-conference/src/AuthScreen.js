import React, {useState, useEffect} from "react";
import './AuthScreen.css';

const States = Object.freeze({
	Init: Symbol("init"),
	Authenticating: Symbol("authenticating"),
	LoggedIn: Symbol("logged-in"),
});

export function AuthScreen({controller}){
	if( !controller ) {
		throw new Error("Controller null");
	}
	const [state,setState] = useState(States.Init);
	const [message, setMessage] = useState(null);
	let changeState = false; //TODO: Design pressures push the state into being extracted.

	const attemptLogin = (name) => {
		setState(States.Authenticating);
		controller.doAuthenticate(name).then((result) => {
			if( result.ok ){
				if( changeState) { setState(States.LoggedIn); }
			} else {
				if( changeState ){
					setMessage(result.error);
					setState(States.Init);
				}
			}
		}, (error) => {
			if( changeState ){
				setState(States.Init);
			}
		});
	};

	useEffect(() =>{
		changeState = true;
		return () => { changeState = false; }
	})

	return (<div className='auth-screen'>
		<h3>Log In</h3>
		<div>
			{message && <div>{message}</div> }
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
