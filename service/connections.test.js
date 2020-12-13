const {newConnections, ConnectionMessages} = require("./connections");
const {LocalActorSystem} = require( "../stagecraft" );
const {Connection, WebSocketServer} = require( "../stagecraft/actor-websocket.js" );
const {expect } = require("chai");

const Login = Symbol("muc.login");
function newFakePort(theater){
	const messages = [];
	const actor = theater.spawnPort((state,type,message,ctx) => {
		messages.push({type,message});
	});
	return {
		actor,
		messages
	}
}

describe("Connections", function (){
	describe("Given a new connection", function (){
		describe("When logging in with an ID", function (){
			it("registers the user", async function (){
				const theater = new LocalActorSystem();
				const fakeConnection = newFakePort(theater);
				const connections = newConnections(theater);
				connections.sessionManager.send(Connection, fakeConnection.actor.pid);
				await theater.allMessagesDelivered();
				await theater.endJoin();
				// console.log("Port messages", fakeConnection.messages);
				expect(fakeConnection.messages[1]).to.deep.eq({type:ConnectionMessages.Hello,message: {version:0}});
			});
		});
	});
});
