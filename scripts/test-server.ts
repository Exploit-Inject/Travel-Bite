import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { testAdmin } from "../tests/fixtures/admin";
const replica = await MongoMemoryReplSet.create({
  instanceOpts: [{ port: 27028 }],
  replSet: { name: "travelbiteTest", count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = replica.getUri();
process.env.MONGODB_DB = "travel_bite_e2e";
process.env.BETTER_AUTH_URL = "http://localhost:3100";
process.env.BETTER_AUTH_SECRET =
  "travel-bite-e2e-only-secret-never-use-in-production";
process.env.DEV_SMS = "true";
process.env.RAZORPAY_KEY_ID = "";
process.env.RAZORPAY_KEY_SECRET = "";
process.env.RAZORPAY_WEBHOOK_SECRET = "travel-bite-test-webhook-secret";
process.env.NEXT_DIST_DIR = process.env.E2E_DIST_DIR || ".data/next-e2e";
const { seed } = await import("./seed");
await seed();
const { provisionAdmin } = await import("../src/lib/admin-account");
await provisionAdmin(testAdmin);
const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "dev", "--port", "3100"],
  { env: process.env, stdio: "inherit" },
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  child.kill();
  await replica.stop();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
child.on("exit", close);
