import test from "node:test";
import assert from "node:assert/strict";
import { createPhoneOtpProvider, SmsDeliveryError } from "../src/lib/phone-otp";
const settings = {
  NODE_ENV: "production",
  TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
  TWILIO_AUTH_TOKEN: "test-token-only",
  TWILIO_VERIFY_SERVICE_SID: `VA${"b".repeat(32)}`,
};
const input = { phoneNumber: "+919810000001", code: "123456" };
const noNetwork: typeof fetch = async () => {
  throw new Error("Unexpected network request");
};

test("local SMS mode retains internal OTP verification and never contacts Twilio", async () => {
  const lines: string[] = [];
  const provider = createPhoneOtpProvider(
    { ...settings, NODE_ENV: "development", DEV_SMS: "true" },
    noNetwork,
    (line) => lines.push(line),
  );
  await provider.sendOTP(input);
  assert.equal(provider.verifyOTP, undefined);
  assert.equal(provider.expiresIn, 300);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes(input.code));
});
test("production ignores DEV_SMS and sends via Verify without a From number or custom code", async () => {
  const requests: { url: string; options?: RequestInit }[] = [];
  const transport: typeof fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return Response.json({ status: "pending" });
  };
  const provider = createPhoneOtpProvider(
    { ...settings, DEV_SMS: "true" },
    transport,
    () => assert.fail("Production must not log codes"),
  );
  await provider.sendOTP(input);
  assert.ok(provider.verifyOTP);
  assert.equal(provider.expiresIn, 600);
  assert.equal(
    requests[0].url,
    `https://verify.twilio.com/v2/Services/${settings.TWILIO_VERIFY_SERVICE_SID}/Verifications`,
  );
  const body = requests[0].options?.body as URLSearchParams;
  assert.equal(body.get("To"), input.phoneNumber);
  assert.equal(body.get("Channel"), "sms");
  assert.equal(body.has("Code"), false);
  assert.equal(body.has("CustomCode"), false);
  assert.equal(body.has("From"), false);
});
test("Verify approves only a provider-confirmed code and rejects pending or consumed codes", async () => {
  for (const [status, http, expected] of [
    ["approved", 200, true],
    ["pending", 200, false],
    ["expired", 200, false],
    ["missing", 404, false],
  ] as const) {
    const provider = createPhoneOtpProvider(settings, async (url, options) => {
      assert.ok(String(url).endsWith("/VerificationCheck"));
      assert.equal((options?.body as URLSearchParams).get("Code"), input.code);
      return Response.json({ status }, { status: http });
    });
    assert.equal(await provider.verifyOTP!(input), expected);
  }
});
test("malformed codes and phone numbers are rejected before contacting Verify", async () => {
  const provider = createPhoneOtpProvider(settings, noNetwork);
  assert.equal(await provider.verifyOTP!({ ...input, code: "12345" }), false);
  assert.equal(
    await provider.verifyOTP!({ ...input, phoneNumber: "not-a-phone" }),
    false,
  );
});
test("provider failures do not fall back to accepting the internal code or disclose credentials", async () => {
  for (const status of [401, 429, 500]) {
    const provider = createPhoneOtpProvider(settings, async () =>
      Response.json({ message: settings.TWILIO_AUTH_TOKEN }, { status }),
    );
    await assert.rejects(
      provider.verifyOTP!(input),
      (error) =>
        error instanceof SmsDeliveryError &&
        !error.message.includes(settings.TWILIO_AUTH_TOKEN) &&
        error.rateLimited === (status === 429),
    );
  }
  const misconfigured = createPhoneOtpProvider(
    { ...settings, TWILIO_AUTH_TOKEN: undefined },
    noNetwork,
  );
  await assert.rejects(misconfigured.sendOTP(input), /not configured/);
});
test("a failed Verify send is not reported as sent, and legacy paid SMS keeps internal verification", async () => {
  const refused = createPhoneOtpProvider(settings, async () =>
    Response.json({ status: "failed" }),
  );
  await assert.rejects(refused.sendOTP(input), /did not start/);
  const legacy = createPhoneOtpProvider(
    {
      ...settings,
      TWILIO_VERIFY_SERVICE_SID: undefined,
      TWILIO_FROM_NUMBER: "+15550001111",
    },
    async (url, options) => {
      assert.ok(String(url).includes("/Messages.json"));
      assert.ok(
        (options?.body as URLSearchParams).get("Body")?.includes(input.code),
      );
      return Response.json({ status: "queued" });
    },
  );
  assert.equal(legacy.verifyOTP, undefined);
  await legacy.sendOTP(input);
});
