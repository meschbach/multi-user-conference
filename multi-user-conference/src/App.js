import './App.css';
import React, {useEffect,useState} from "react";

import {newGameState, States} from "./game-state";
import {AuthScreen} from "./AuthScreen";
import {OutputObserver} from "./output-observer";
import {PlayScreen} from "./playing/play-screen";

const controller = newGameState();
const log = new OutputObserver();
log.watch(controller);

function App() {
    const [isAuthenticated, setAuthenticated] = useState(controller.isAuthenticated);
    useEffect(() => {
        const listener = () => {
            setAuthenticated(controller.isAuthenticated);
        }
        controller.on(States.OnChange, listener);
        controller.digest();
        return () => controller.off(States.OnChange, listener);
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
