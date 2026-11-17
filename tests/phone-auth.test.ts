import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { phoneNumber } from "better-auth/plugins";
import { createPhoneOtpProvider } from "../src/lib/phone-otp";

test("Better Auth accepts only the code approved by Verify, creates a session, and rejects replay", async () => {
  const replica = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const client = await new MongoClient(replica.getUri()).connect();
  try {
    const db = client.db("verify_adapter_test");
    let approvedCode = "654321",
      consumed = false;
    const provider = createPhoneOtpProvider(
      {
        NODE_ENV: "production",
        TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
        TWILIO_AUTH_TOKEN: "isolated-test-token",
        TWILIO_VERIFY_SERVICE_SID: `VA${"b".repeat(32)}`,
      },
      async (url, options) => {
        if (String(url).endsWith("/Verifications"))
          return Response.json({ status: "pending" });
        if (consumed) return Response.json({}, { status: 404 });
        if ((options?.body as URLSearchParams).get("Code") === approvedCode) {
          consumed = true;
          return Response.json({ status: "approved" });
        }
        return Response.json({ status: "pending" });
      },
    );
    const auth = betterAuth({
      baseURL: "http://localhost:3199",
      secret: "isolated-verify-test-secret-never-use-in-production",
      database: mongodbAdapter(db, { client }),
      plugins: [
        phoneNumber({
          ...provider,
          otpLength: 6,
          allowedAttempts: 5,
          signUpOnVerification: {
            getTempEmail: (phone) =>
              `${phone.replace("+", "")}@phone.travelbite.invalid`,
          },
        }),
      ],
    });
    async function post(path: string, body: unknown) {
      return auth.handler(
        new Request(`http://localhost:3199/api/auth/phone-number/${path}`, {
          method: "POST",
          headers: {
            Origin: "http://localhost:3199",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      );
    }
    const phone = "+919810000001";
    const sent = await post("send-otp", { phoneNumber: phone });
    assert.equal(sent.status, 200, await sent.text());
    const internal = await db
      .collection("verification")
      .findOne({ identifier: { $regex: "9810000001" } });
    assert.ok(internal);
    const internalCode = String(internal.value).split(":")[0];
    if (internalCode === approvedCode) approvedCode = "123456";
    const rejected = await post("verify", {
      phoneNumber: phone,
      code: internalCode,
    });
    assert.equal(rejected.status, 400);
    const verified = await post("verify", {
      phoneNumber: phone,
      code: approvedCode,
    });
    assert.equal(verified.status, 200, await verified.text());
    assert.ok(verified.headers.get("set-cookie")?.includes("session_token"));
    const user = await db.collection("user").findOne({ phoneNumber: phone });
    assert.equal(user?.phoneNumberVerified, true);
    const replay = await post("verify", {
      phoneNumber: phone,
      code: approvedCode,
    });
    assert.equal(replay.status, 400);
    assert.equal(
      await db.collection("user").countDocuments({ phoneNumber: phone }),
      1,
    );
  } finally {
    await client.close();
    await replica.stop();
  }
});
