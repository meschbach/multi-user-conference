import React, {useEffect, useState} from "react";
import {RoomEvents} from "muc-client/client";
import {States} from "../game-state";

export function ViewRoomChat({controller}){
	const [messages,setMessages] = useState([]);

	useEffect(() => {
		const onRoomMessage = (message) => {
			setMessages([].concat(messages, [message]));
		}
		const onNewRoom = () => {
			setMessages([]);
		}
		controller.client.on(RoomEvents.ChatBroadcast, onRoomMessage);
		controller.on(States.NewRoom, onNewRoom);
		return () => {
			controller.client.off(RoomEvents.ChatBroadcast, onRoomMessage);
			controller.off(States.NewRoom, onNewRoom);
		}
	}, [controller]);

	return (<ul>
		{messages.map((m, index) => <li key={index}>{m.from}: {m.what}</li>)}
	</ul>);
}
