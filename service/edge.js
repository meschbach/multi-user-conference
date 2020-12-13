const {main} = require( "junk-bucket" );
const {Context} = require( "junk-bucket/context" );
const {Future} = require("junk-bucket/future");

const {MultiUserConferenceServer} = require("./service");
const {setupJaeger} = require("./jaeger");

main(async (logger) => {
	const rootContext = new Context("multi-user-conference-edge", logger);
	setupJaeger(rootContext);
	const doneSignal = new Future();

	try {
		const service = new MultiUserConferenceServer(rootContext.opentracing.tracer);
		const address = await service.startInProcess(9400);
		rootContext.logger.info("Started Multiuser Conference", address);
		await doneSignal.promised;
	}catch (e) {
		logger.error("Failed to initialize system", e);
	}finally {
		await rootContext.cleanup();
	}
});
