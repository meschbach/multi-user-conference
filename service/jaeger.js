const {initTracerFromEnv, opentracing} = require('jaeger-client');
const {delay} = require("junk-bucket/future");

function setupJaeger(context){
	const config = {
		serviceName:  process.env["JAEGER_SERVICE_NAME"] || 'muc.service',
		sampler: {
			type: "const",
			param: 1,
		}
	};
	const tracer = initTracerFromEnv(config);
	context.opentracing = {
		tracer
	}
	context.onCleanup(async () => {
		context.opentracing = undefined;
		tracer.close();
		await delay(10);
	});
}

module.exports = {
	setupJaeger
}
