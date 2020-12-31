const {Router} = require("express");
const { createProxyMiddleware } = require('http-proxy-middleware');

function createOpenTelemetryProxy() {
	const router = new Router();
	router.use("/proxy", createProxyMiddleware({target: process.env, changeOrigin: true}) );
	return router;
}

modules.export = {
	createOpenTelemetryProxy
}
