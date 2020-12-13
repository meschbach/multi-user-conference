const {Actor_Started} = require( "../stagecraft" );
const {DictionaryActor, Notify, Listen, Message, Send} = require( "../stagecraft/actor-junk.js" );
const {Connection, WebSocketServer} = require( "../stagecraft/actor-websocket.js" );

function SessionManager() {
	return DictionaryActor({
		[Connection]: (state,type,pid,theater) => {
			const handler = theater.spawn(SessionConnection(pid,theater.self));
		}
	});
}

const ConnectionMessages = {
	Hello: Symbol("muc.hello"),
	Login: Symbol("muc.login"),
	LoginFailed: Symbol("muc.login.failed"),
	LoggedIn: Symbol("muc.login.success")
};

function SessionConnection( wsPort, sessionManager ) {
	return DictionaryActor({
		[Actor_Started]: (state = {}, type, message, ctx) => {
			ctx.send( wsPort, ConnectionMessages.Hello, {version: 0, pid: ctx.self} );
			return {
				ws: wsPort
			};
		},
		[Message]: (state,type,pid,theater) => {

		}
	});
}

function newConnections(theater) {
	const sessionManager = theater.spawn(SessionManager());
	return {
		sessionManager
	};
}

module.exports = {
	newConnections,
	ConnectionMessages
}
