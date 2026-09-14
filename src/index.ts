import { Hono } from "hono";
import { logger } from "hono/logger";
import { config, validateConfig } from "./config";
import { findDuplicateGroups, reconcileDuplicates } from "./lib/dedupe";
import { listDomains, listResources } from "./lib/pangolin";
import { type DokployEvent, handleWebhook } from "./lib/webhook";

const app = new Hono();

validateConfig();

app.use(logger());

app.use("/webhook", async (c, next) => {
	if (c.req.header("x-webhook-secret") !== config.webhookSecret) {
		console.warn("Unauthorized webhook attempt detected.");
		return c.text("Unauthorized", 401);
	}

	return next();
});

app.use("/duplicates", async (c, next) => {
	if (c.req.header("x-webhook-secret") !== config.webhookSecret) {
		console.warn("Unauthorized duplicates attempt detected.");
		return c.text("Unauthorized", 401);
	}

	return next();
});

app.get("/", (c) => {
	return c.text("OK");
});

app.post("/webhook", async (c) => {
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

// GET reports duplicated host names, DELETE removes all but the oldest.
app.on(["GET", "DELETE"], "/duplicates", async (c) => {
	try {
		const result = await reconcileDuplicates({
			apply: c.req.method === "DELETE",
		});

		if (!result) {
			return c.json({ error: "Could not list Pangolin resources" }, 502);
		}

		return c.json({
			scanned: result.scanned,
			applied: result.applied,
			deleted: result.deleted.length,
			renamed: result.renamed.map((entry) => ({
				resourceId: entry.resource.resourceId,
				from: entry.resource.name,
				to: entry.name,
			})),
			failed: result.failed.length,
			groups: result.groups.map((group) => ({
				fullDomain: group.fullDomain,
				keep: { resourceId: group.keep.resourceId, name: group.keep.name },
				duplicates: group.duplicates.map((duplicate) => ({
					resourceId: duplicate.resourceId,
					name: duplicate.name,
				})),
			})),
		});
	} catch (error) {
		console.error("Exception while reconciling duplicates:", error);
		return c.json({ error: "Internal Server Error" }, 500);
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

// Surface pre-existing duplicates without touching them - deleting resources
// on boot would be far too eager.
void listResources()
	.then((resources) => {
		const groups = findDuplicateGroups(resources ?? []);

		if (groups.length > 0) {
			const total = groups.reduce((n, g) => n + g.duplicates.length, 0);
			console.warn(
				`Found ${total} duplicate resource(s) across ${groups.length} host name(s): ${groups.map((g) => g.fullDomain).join(", ")}. Run "bun run reconcile --apply" or DELETE /duplicates to clean up.`,
			);
		}
	})
	.catch((error) => {
		console.error("Error checking for duplicates on startup:", error);
	});
