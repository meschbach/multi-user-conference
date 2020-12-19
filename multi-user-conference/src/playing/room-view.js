import React, {useState,useEffect} from "react";
import {States} from "../game-state";

/**
 * Container to extract details of the current room from the player state
 * @param playerState current state of the world
 * @returns {JSX.Element}
 * @constructor
 */
export function CurrentRoomView({playerState}){
	if( !playerState ) { throw new Error("playerState"); }
	const [currentRoom,setCurrentRoom] = useState(playerState.currentRoom);

	useEffect(() => {
		const roomListener = (room) => {
			setCurrentRoom(room)
		};
		playerState.on(States.NewRoom, roomListener)
		return () => {
			playerState.off(States.NewRoom, roomListener);
		}
	}, [playerState]);

	if( currentRoom ){
		return (<RoomView room={currentRoom}/>)
	} else {
		return (<div>Not in a room</div>);
	}
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
