
function traceError( span, error ){
	span.setTag("error", true);
	span.log({"error.kind": "error", "error.object": error, event: "error", "message": error.message});
}

async function traceOp(fn, name, tracer, parent, options = {}){
	if( !parent ){ throw new Error("parent span must exist"); }
	options.childOf = parent;
	const span = tracer.startSpan(name, options);
	try {
		return await fn(span);
	}catch (e){
		traceError(span,e);
		throw e;
	}finally {
		span.finish();
	}
}

module.exports = {
	traceOp,
	traceError
}
