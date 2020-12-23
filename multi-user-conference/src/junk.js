import {useEffect, useState} from "react";

export function useWatchedValue(from,event,reducer) {
	const currentState = reducer(from);
	const [state,setState] = useState(currentState);

	useEffect(() => {
		const listener = () => {
			const newState = reducer(from);
			setState(newState);
		};

		from.on(event, listener );
		return () => {
			from.off(event, listener );
		}
	}, [from, event, reducer]);
	return state;
}
