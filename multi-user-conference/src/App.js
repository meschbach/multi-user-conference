import './App.css';
import React, {useEffect,useState} from "react";

import {InputPanel} from "./input";
import {newGameState, States} from "./game-state";
import EventEmitter from "eventemitter3";

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
    useEffect(() => {
        controller.digest();
    });

    const onEval = (value) => {
        controller.input(value);
    };
  return (
      <div className='frame'>
          <div className='frame-input'>
              <InputPanel onEvaluate={onEval}/>
          </div>
          <div className='frame-output'>
              <OutputPane log={log}/>
          </div>
      </div>
  );
}

function OutputPane({log}){
    const [current,setState] = useState(log.messages[0] || {});
    const [loginError, setLoginError] = useState({show: false});
    useEffect(() => {
        const onUpdate = () => {
            if( log.messages[0].to === States.PreAuth ){
                if( log.messages[1].type === States.Error ){
                    setLoginError({show:true, message: log.messages[1].message})
                }
            }
            setState(log.messages[0]);
        };
        log.on("update", onUpdate);
        return () => {
            log.off("update", onUpdate);
        }
    }, [log]);

    if( !current ){
        return (<div>Loading...</div>);
    }
    if( current["to"] === States.PreAuth ){
        return (<div>
            {loginError.show && <div>{loginError.message}</div>}
            Please enter a user name.
        </div>);
    }

    return (<RenderLog log={log}/>);
}

function RenderLog({log}){
    const [output,setOutput] = useState(log.messages);

    useEffect(() => {
        const onUpdate = () => {
            setOutput([].concat(log.messages));
        };
        log.on("update", onUpdate);
        return () => {
            log.off("update", onUpdate);
        }
    }, [log]);

    function formatMessage(o){
        switch (o.type){
            case States.OnChange:
                return o.from.toString() + " -> " + o.to.toString();
            case States.Error:
                return "ERROR: " + o.message;
            case States.NewRoom:
                return (<RoomView room={o.room}/>);
            default:
                return JSON.stringify(o);
        }
    }

    return (<ul>
        {output.map((o) => <li key={o.id}>{formatMessage(o)}</li> )}
    </ul>);
}

function RoomView({room}){
    const {name,description,exits} = room;
    return (<div>
        <h3>{name}</h3>
        <p>{description}</p>
        <div>
            <h4>Exits</h4>
            <p>{exits.map(exit => <span key={exit}>{exit}</span>)}</p>
        </div>
    </div>)
}

export default App;
