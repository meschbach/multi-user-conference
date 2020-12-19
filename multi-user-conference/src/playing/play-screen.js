import {InputPanel} from "./input";
import {CurrentRoomView} from "./room-view";
import {RenderLog} from "./event-log";
import React from "react";
import "./play-screen.css";

/**
 * Root for user interaction screens.
 *
 * @param onEval places user input into the game engine
 * @param controller client state controller
 * @param log system state change obeserver
 * @returns {JSX.Element}
 * @constructor
 */
export function PlayScreen({onEval,controller, log}){
	return (
		<div className='play-screen'>
			<main>
				<InputPanel onEvaluate={onEval}/>
				<CurrentRoomView playerState={controller}/>
			</main>
			<div className='game-log'>
				<h4>Event Log</h4>
				<RenderLog log={log}/>
			</div>
		</div>
	);
}
