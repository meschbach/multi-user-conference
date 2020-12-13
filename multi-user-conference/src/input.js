import React, {useState} from "react";

export function InputPanel({onEvaluate}) {
	const [current, update] = useState("");
	function onChange(event) {
		update(event.target.value)
	}

	function onKey(event){
		if( event.code === "Enter" ){
			const command = current;
			update("");
			onEvaluate(command);
		}
	}

	return (<input onChange={onChange} onKeyPress={onKey} autoFocus={true} value={current}/>)
}
