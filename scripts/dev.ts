import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

let replica:
  { stop: (options: { doCleanup: boolean }) => Promise<unknown> } | undefined;
if (!process.env.MONGODB_URI) {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  const dbPath = resolve(".data/mongo");
  await mkdir(dbPath, { recursive: true });
  console.info(
    "Starting local MongoDB. The first run downloads MongoDB; data stays in .data/mongo.",
  );
  const server = await MongoMemoryReplSet.create({
    instanceOpts: [{ dbPath }],
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  replica = server;
  process.env.MONGODB_URI = server.getUri();
  // This file contains only the auto-started, unauthenticated loopback URI.
  // Never write an externally configured URI or any service credentials here.
  await writeFile(
    resolve(".data/local-db.json"),
    JSON.stringify({
      uri: process.env.MONGODB_URI,
      database: process.env.MONGODB_DB || "travel_bite",
    }),
  );
}
process.env.BETTER_AUTH_SECRET ||= randomBytes(32).toString("hex");
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
process.env.DEV_SMS ??= "true";
const { seed } = await import("./seed");
await seed();
const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "dev", ...process.argv.slice(2)],
  { stdio: "inherit", env: process.env },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill();
  await replica?.stop({ doCleanup: false });
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", async (code) => {
  await replica?.stop({ doCleanup: false });
  process.exit(code ?? 0);
});
