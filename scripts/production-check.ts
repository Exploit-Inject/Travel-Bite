import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { cp } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { getMongoClient } from "../src/lib/db";
const replica = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = replica.getUri();
process.env.MONGODB_DB = "travel_bite_production_check";
process.env.BETTER_AUTH_URL = "http://localhost:3200";
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
process.env.SEED_SAMPLE_DATA = "true";
process.env.RAZORPAY_KEY_ID = "";
process.env.RAZORPAY_KEY_SECRET = "";
process.env.TWILIO_ACCOUNT_SID = "";
process.env.TWILIO_AUTH_TOKEN = "";
process.env.TWILIO_VERIFY_SERVICE_SID = "";
const { seed } = await import("./seed");
await seed();
await cp("public", ".next/standalone/public", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
const child = spawn(process.execPath, [resolve(".next/standalone/server.js")], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3200",
    HOSTNAME: "127.0.0.1",
  },
  stdio: "inherit",
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch("http://localhost:3200/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("Production server did not become ready.");
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const response = await page.goto("http://localhost:3200/");
  const csp = response?.headers()["content-security-policy"];
  if (!csp?.includes("strict-dynamic") || csp.includes("unsafe-eval"))
    throw new Error("Production CSP is missing or permits eval.");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page
    .getByRole("button", { name: "Login with password", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Production Check");
  await page.getByLabel("Mobile number").fill("9810007777");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Production-check-password-2026!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Production-check-password-2026!");
  await page.getByRole("button", { name: "Create account & continue" }).click();
  await page
    .getByRole("dialog", { name: "Login with password" })
    .waitFor({ state: "hidden" });
  const me = await page.request.get("http://localhost:3200/api/me");
  if (
    !(await me.json()).user ||
    !me.headers()["cache-control"]?.includes("no-store")
  )
    throw new Error("Production session or privacy headers failed.");
  await page.evaluate(() => {
    const element = document.createElement("div");
    element.innerHTML =
      '<img src="/missing-security-check.png" onerror="window.__travelBiteInjected = true">';
    document.body.appendChild(element);
  });
  await page.waitForTimeout(500);
  const injected = await page.evaluate(() =>
    Boolean(
      (window as unknown as Record<string, unknown>).__travelBiteInjected,
    ),
  );
  if (injected) throw new Error("CSP did not block an injected inline script.");
  console.info(
    "Production browser check passed: mobile password signup, session cookies, private API caching, nonce CSP, and injected-script blocking.",
  );
} finally {
  await browser?.close();
  child.kill();
  await (await getMongoClient()).close();
  await replica.stop();
}
