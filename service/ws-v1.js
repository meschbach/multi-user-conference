const {CommandDispatcher} = require("junk-bucket/command-dispatcher");

function replyClientError(message,context){
	context.send({action:"client.error", error: "requested action does not exist", attemptedAction: message.action});
}

function setupWebsocketV1(){
	const rpcHandler = new CommandDispatcher( replyClientError );
	return rpcHandler;
}

module.exports = {
	setupWebsocketV1
}
