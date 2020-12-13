const {initTracerFromEnv, opentracing} = require('jaeger-client');
const {delay} = require("junk-bucket/future");

const config = {
	serviceName:  'muc.test',
	sampler: {
		type: "const",
		param: 1,
	}
};
const tracer = initTracerFromEnv(config);

after(async () => {
	tracer.close();
	await delay(10);
});

module.exports = {
	tracer
}
