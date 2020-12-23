import React, {useEffect, useState} from "react";
import {RoomEvents} from "muc-client/client";

export function ViewRoomChat({controller}){
	const [messages,setMessages] = useState([]);

	useEffect(() => {
		const onRoomMessage = (message) => {
			setMessages([].concat(messages, [message]));
		}
		controller.client.on(RoomEvents.ChatBroadcast, onRoomMessage);
		return () => {
			controller.client.off(RoomEvents.ChatBroadcast, onRoomMessage);
		}
	}, [controller, messages]);

	return (<ul>
		{messages.map((m, index) => <li key={index}>{JSON.stringify(m)}: {m.what}</li>)}
	</ul>);
}
