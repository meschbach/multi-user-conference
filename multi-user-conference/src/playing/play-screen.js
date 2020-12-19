import {InputPanel} from "../input";
import {CurrentRoomView} from "./room-view";
import {RenderLog} from "./event-log";
import React from "react";

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
		<div className='frame'>
			<div className='frame-input'>
				<InputPanel onEvaluate={onEval}/>
			</div>
			<div className='frame-output'>
				<div className='room-view'>
					<CurrentRoomView playerState={controller}/>
				</div>
				<div className='game-log'>
					<RenderLog log={log}/>
				</div>
			</div>
		</div>
	);
}
