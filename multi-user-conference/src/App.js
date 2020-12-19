import './App.css';
import React, {useEffect,useState} from "react";

import {InputPanel} from "./input";
import {newGameState, States} from "./game-state";
import {AuthScreen} from "./AuthScreen";
import {RenderLog} from "./event-log";
import {CurrentRoomView} from "./room-view";
import {OutputObserver} from "./output-observer";

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

  return (
      <div className='frame'>
          <div className='frame-input'>
              <InputPanel onEvaluate={onEval}/>
          </div>
          <div className='frame-output'>
              <CurrentRoomView playerState={controller}/>
              <RenderLog log={log}/>
          </div>
      </div>
  );
}

export default App;
