const {Dispatcher} = require("junk-bucket/command-dispatcher");
const {Disconnect} = require("./common");

/*
 * Chat Related
 */
async function sendWhisper(message, context){
	if( context.userName ){
		const {to, message: msg} = message;
		const user = context.coordinator.findUser(to);
		if( !user ){
			return {action: "chat.whisper.sent", success: false, reason: "user not online"};
		}
		user.whispered(this.userName, msg, context.span);
		return {action: "chat.whisper.sent", success: true};
	} else {
		context.forceDisconnect(Disconnect.NotAuthenticated);
	}
}

/*
 * General Handlers
 */
function replyClientError(message,context){
	context.send({action:"client.error", error: "requested action does not exist", attemptedAction: message.action});
}

/*
 * Factory
 */
function setupWebsocketV1(){
	const rpcHandler = new Dispatcher( replyClientError );
	//Chat
	rpcHandler.register("chat.whisper", sendWhisper)
	return rpcHandler;
}

module.exports = {
	setupWebsocketV1
}
