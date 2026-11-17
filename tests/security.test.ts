import test from "node:test";
import assert from "node:assert/strict";
import { authSettings } from "../src/lib/config";
import { BodyTooLarge, readBody } from "../src/lib/request-body";
import { contentSecurityPolicy } from "../src/lib/security-headers";

test("production authentication rejects missing, weak, and insecure deployment settings", () => {
  assert.throws(() => authSettings({ NODE_ENV: "production" }), /SECRET/);
  assert.throws(
    () =>
      authSettings({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "a".repeat(40),
      }),
    /URL/,
  );
  assert.throws(
    () =>
      authSettings({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "a".repeat(40),
        BETTER_AUTH_URL: "http://travelbite.example",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      authSettings({
        NODE_ENV: "production",
        VERCEL: "1",
        BETTER_AUTH_SECRET: "a".repeat(40),
        BETTER_AUTH_URL: "http://localhost:3000",
      }),
    /HTTPS/,
  );
  assert.throws(
    () => authSettings({ BETTER_AUTH_URL: "https://travelbite.example/admin" }),
    /origin/,
  );
  assert.throws(
    () =>
      authSettings({
        BETTER_AUTH_URL: "https://user:password@travelbite.example",
      }),
    /origin/,
  );
  const good = authSettings({
    NODE_ENV: "production",
    BETTER_AUTH_SECRET: "production-test-secret-with-32-characters",
    BETTER_AUTH_URL: "https://travelbite.example/",
  });
  assert.equal(good.origin, "https://travelbite.example");
  assert.equal(good.secureCookies, true);
});
test("body limits are enforced for both declared and streamed payloads", async () => {
  await assert.rejects(
    readBody(
      new Request("http://localhost", {
        method: "POST",
        body: "12345",
        headers: { "content-length": "5" },
      }),
      4,
    ),
    BodyTooLarge,
  );
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("123"));
      controller.enqueue(new TextEncoder().encode("456"));
      controller.close();
    },
  });
  const request = new Request("http://localhost", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readBody(request, 4), BodyTooLarge);
  assert.equal(
    new TextDecoder().decode(
      await readBody(
        new Request("http://localhost", { method: "POST", body: "1234" }),
        4,
      ),
    ),
    "1234",
  );
});
test("production CSP uses a nonce, blocks inline scripts and eval, and permits payment frames", () => {
  const csp = contentSecurityPolicy("test-nonce");
  const scripts = csp.split(";").find((value) => value.includes("script-src"))!;
  assert.match(scripts, /nonce-test-nonce/);
  assert.match(scripts, /strict-dynamic/);
  assert.doesNotMatch(scripts, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /frame-src https:\/\/\*\.razorpay.com/);
});
