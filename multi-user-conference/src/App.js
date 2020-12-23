import './App.css';
import React from "react";

import {newGameState, States} from "./game-state";
import {AuthScreen} from "./AuthScreen";
import {OutputObserver} from "./output-observer";
import {PlayScreen} from "./playing/play-screen";
import {useWatchedValue} from "./junk";

const controller = newGameState();
const log = new OutputObserver();
log.watch(controller);

function App() {
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
