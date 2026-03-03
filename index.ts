import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "mysecret";

type DokployEvent = {
  title: string;
  message: string;
  timestamp: string;
};

app.use(logger());

app.get("/", (c) => {
  return c.text("Hello, World!");
});

app.post("/webhook", async (c) => {
  const authHeader = c.req.header("x-webhook-secret");

  if (authHeader !== WEBHOOK_SECRET) {
    console.warn("Unauthorized webhook attempt detected.");
    return c.text("Unauthorized", 401);
  }

  const payload: DokployEvent = await c.req.json();

  console.log("Webhook payload received:", payload);

  return c.text("Webhook processed", 200);
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
