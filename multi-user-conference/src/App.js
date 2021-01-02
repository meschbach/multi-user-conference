import './App.css';
import React from "react";

import {newGameState, States} from "./game-state";
import {AuthScreen} from "./AuthScreen";
import {OutputObserver} from "./output-observer";
import {PlayScreen} from "./playing/play-screen";
import {useWatchedValue} from "./junk";
import {setupTracing} from "./tracing";
import {ConfigLoader, ConfigState} from "./config";
import EventEmitter from "eventemitter3";

class AppState extends EventEmitter {
    constructor() {
        super();
        this.state = ConfigState.Initial;
        this.configLoader = new ConfigLoader();
    }

    async start() {
        if( this.state !== ConfigState.Initial ){ return; }
        this._updateState(ConfigState.Loading);
        try {
            const config = await this.configLoader.config();
            this.tracer = await setupTracing(config);
            this.controller = newGameState(this.tracer);
            this.log = new OutputObserver(this.tracer);
            this.log.watch(this.controller);
            this._updateState(ConfigState.Loaded);
        }catch(e){
            this._updateState(ConfigState.Failed);
            console.error("Failed to start system", e);
        }
    }

    _updateState(newState){
        const old = this.state;
        this.state = newState;
        this.emit("state", {state: {from: old, to: newState}, source:this});
    }
}
const globalState = new AppState();

function App() {
    const appLoadingState = useWatchedValue(globalState, "state", (state) => state.state);

    if( appLoadingState === ConfigState.Initial ){
        globalState.start();
        return (<div>Starting...</div>);
    }

    if( appLoadingState === ConfigState.Failed){
        return (<div>Failed to load.</div>);
    }
    if( appLoadingState === ConfigState.Loaded){
        return (<LoadedAppView controller={globalState.controller} log={globalState.log}/>);
    }
    return (<div>Loading ({appLoadingState.toString()})...</div>);
}

function LoadedAppView({controller, log}){
    const isAuthenticated = useWatchedValue(controller, States.OnChange, (subject) => {
        subject.digest();
        return subject.isAuthenticated;
    });

    const onEval = (value) => {
        controller.input(value);
    };

    if( !isAuthenticated ){
        return (<AuthScreen controller={controller}/>);
    }
    return (<PlayScreen controller={controller} onEval={onEval} log={log}/>);
}

export default App;
