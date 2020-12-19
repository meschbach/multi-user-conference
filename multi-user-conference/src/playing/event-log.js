import React, {useEffect, useState} from "react";
import {States} from "../game-state";

export function RenderLog({log}){
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
				return (<div>Room: {o.room.id}</div>);
			default:
				return JSON.stringify(o);
		}
	}

	return (<ul>
		{output.map((o) => <li key={o.id}>{formatMessage(o)}</li> )}
	</ul>);
}
