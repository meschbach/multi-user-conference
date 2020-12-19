import './App.css';
import React, {useEffect,useState} from "react";

import {InputPanel} from "./input";
import {newGameState, States} from "./game-state";
import EventEmitter from "eventemitter3";
import {AuthScreen} from "./AuthScreen";
import {RenderLog} from "./event-log";
import {CurrentRoomView} from "./room-view";

const controller = newGameState();
class OutputObserver extends EventEmitter {
    constructor() {
        super();
        this.messages = [];
    }

    _push(obj) {
        this.messages.unshift(obj);
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
               id: Date.now(), type: States.NewRoom,
               room
            });
        });
        controller.on(States.Error, ({message}) => {
            this._push({
                id: Date.now(), type: States.Error,
                message
            });
        });
    }
}
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
