const {Future} = require("junk-bucket/future");

function promiseEventWithin(from, name, withinMs) {
	const future = new Future();
	let done = false;
	const handler = (event) => {
		if( done ){ return; }
		done = true;
		clearTimeout(timeout);
		future.accept(event);
	}
	let timeout = setTimeout(() => {
		if( done ){ return; }
		done = true;
		future.reject(new Error("timeout withing for " + name.toString()));
		from.off(name, handler);
	}, withinMs);
	from.once(name, handler);
	from.once('error', (why) => {
		future.reject(why);
	});
	return future.promised;
}

module.exports = {
	promiseEventWithin
}
