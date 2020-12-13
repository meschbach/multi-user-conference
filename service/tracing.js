const {opentracing} = require("jaeger-client");

function traceError( span, error ){
	span.setTag("error", true);
	span.log({"error.kind": "error", "error.object": error, event: "error", "message": error.message});
}

module.exports = {
	traceError,
	opentracing
}
