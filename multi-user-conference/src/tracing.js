/**
 * Implements tracing via OpenTelemetry and flushes back spans
 */
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/tracing';
import { WebTracerProvider } from '@opentelemetry/web';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';

export async function setupTracing(){

	const provider = new WebTracerProvider();
	await loadTracerConfiguration(provider);
	provider.register();

	const openTelemetryTracer = provider.getTracer('muc.react');
	return newBrowserTracer(openTelemetryTracer);
}

async function loadTracerConfiguration(provider){
	const configResponse = await fetch("/config/config.json");
	const {tracing} = await configResponse.json();
	if( !tracing ){
		console.log("No tracing in config, skipping");
		return;
	}

	if( tracing.console ){
		provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
	}

	const {serviceName, zipkin} = tracing;
	if( zipkin && serviceName ){
		const zipkinExporter = new ZipkinExporter({
			url: zipkin,
			serviceName,
			headers: {}
		});
		provider.addSpanProcessor(new SimpleSpanProcessor(zipkinExporter));
	}
}

class BrowserSpan {
	constructor(openTracingSpan) {
		this.openTracingSpan = openTracingSpan;
	}

	log(entry) {
		const {event} = entry;
		console.log("log",event, entry);
		this.openTracingSpan.addEvent(JSON.stringify(entry));
	}

	setTag(name,value){
		this.openTracingSpan.setAttribute(name, value);
	}

	finish() {
		this.openTracingSpan.end();
	}

	toSpanParent() {
		return this.openTracingSpan;
	}
}

function leftPad(original,count, char = "0"){
	let str = "" + original;
	while(str.length < count ){
		str = char + str;
	}
	return str;
}

function internalizeParentage(options, childOf ){
	const postActions = [];
	if( !childOf ){ return postActions; }

	if( childOf.split ) { // Assume Uber trace string
		const parts = childOf.split(":");
		const traceID = parts[0]
		const parentID = parts[1];
		postActions.push((otSpan) => {
			otSpan.context().traceId = traceID;
			otSpan.parentSpanId = leftPad(parentID, 16);
		});
	} else if ( childOf.toSpanParent ) {
		const parentSpan = childOf.toSpanParent();
		postActions.push((otSpan) => {
			const parentContext = parentSpan.context();
			otSpan.context().traceId = parentContext.traceId;
			otSpan.parentSpanId = parentContext.spanId;
		});
	} else {
		options.parent = childOf;
	}
	return postActions;
}

const JAEGER_TRACE_ID = "uber-trace-id";
function newBrowserTracer(openTelemetryTracing){
	return {
		startSpan: (name, options = {}) => {
			const {childOf,...rest} = options;
			const postActions = internalizeParentage(rest, childOf);
			const rawSpan = openTelemetryTracing.startSpan(name, rest);
			postActions.forEach((action) => action(rawSpan));
			return new BrowserSpan(rawSpan);
		},
		extract: (format, carrier) => {
			const id = carrier[JAEGER_TRACE_ID];
			return id;
		},
		inject: (span, format, carrier) => {
			const value = [
				span.openTracingSpan.context().traceId,
				span.openTracingSpan.context().spanId,
				"0",
				"1"
			].join(":");
			carrier[JAEGER_TRACE_ID] = value;
		}
	};
}
