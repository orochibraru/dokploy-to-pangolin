import { Hono } from "hono";
import { logger } from "hono/logger";
import { config, validateConfig } from "./config";
import { listDomains } from "./lib/pangolin";
import { type DokployEvent, handleWebhook } from "./lib/webhook";

const app = new Hono();

validateConfig();

app.use(logger());

app.get("/", (c) => {
	return c.text("OK");
});

app.post("/webhook", async (c) => {
	const authHeader = c.req.header("x-webhook-secret");

	if (authHeader !== config.webhookSecret) {
		console.warn("Unauthorized webhook attempt detected.");
		return c.text("Unauthorized", 401);
	}

	const payload: DokployEvent = await c.req.json();

	try {
		const res = await handleWebhook(payload);

		if (!res.success) {
			console.error("Error processing webhook:", res.message);
		}

		return c.text(res.message, 200);
	} catch (error) {
		console.error("Exception while processing webhook:", error);
		return c.text("Internal Server Error", 500);
	}
});

// Graceful shutdown handling
const shutdown = () => {
	console.log("Shutting down gracefully...");
	process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default {
	port: process.env.PORT || 3000,
	fetch: app.fetch,
};

void listDomains()
	.then((domains) => {
		console.log(
			"Domains available in Pangolin:",
			domains?.map((d) => d.baseDomain),
		);
	})
	.catch((error) => {
		console.error("Error fetching domains on startup:", error);
	});
