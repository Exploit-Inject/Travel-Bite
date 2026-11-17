type OtpInput = { phoneNumber: string; code: string };
type SmsEnvironment = Partial<
  Record<
    | "NODE_ENV"
    | "DEV_SMS"
    | "TWILIO_ACCOUNT_SID"
    | "TWILIO_AUTH_TOKEN"
    | "TWILIO_FROM_NUMBER"
    | "TWILIO_VERIFY_SERVICE_SID",
    string
  >
>;

export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    public rateLimited = false,
  ) {
    super(message);
  }
}

export function createPhoneOtpProvider(
  env: SmsEnvironment = process.env,
  transport: typeof fetch = fetch,
  localLog: (message: string) => void = console.info,
) {
  const localSms = env.NODE_ENV !== "production" && env.DEV_SMS === "true";
  const useVerify = !localSms && Boolean(env.TWILIO_VERIFY_SERVICE_SID);
  async function post(url: string, body: URLSearchParams, checking = false) {
    const sid = env.TWILIO_ACCOUNT_SID,
      token = env.TWILIO_AUTH_TOKEN;
    if (!sid || !token)
      throw new SmsDeliveryError(
        "SMS delivery is not configured. Contact Travel Bite support.",
      );
    let response: Response;
    try {
      response = await transport(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
    } catch {
      throw new SmsDeliveryError(
        "We couldn't reach the SMS provider. Please try again shortly.",
      );
    }
    // Verify removes completed, expired, and exhausted verification resources.
    if (checking && response.status === 404) return null;
    if (response.status === 429)
      throw new SmsDeliveryError(
        "Too many verification attempts. Please wait before trying again.",
        true,
      );
    if (!response.ok)
      throw new SmsDeliveryError(
        "The SMS provider couldn't complete verification. Check your Twilio Verify logs or contact Travel Bite support.",
      );
    try {
      return (await response.json()) as { status?: string };
    } catch {
      throw new SmsDeliveryError(
        "The SMS provider returned an invalid response. Please try again.",
      );
    }
  }
  function serviceUrl(resource: string) {
    const service = env.TWILIO_VERIFY_SERVICE_SID;
    if (!service || !/^VA[0-9a-f]{32}$/i.test(service))
      throw new SmsDeliveryError(
        "A valid Twilio Verify Service SID is required.",
      );
    return `https://verify.twilio.com/v2/Services/${service}/${resource}`;
  }
  return {
    expiresIn: useVerify ? 600 : 300,
    sendOTP: async ({ phoneNumber, code }: OtpInput) => {
      if (localSms) {
        localLog(`[Travel Bite local SMS] ${phoneNumber}: ${code}`);
        return;
      }
      if (useVerify) {
        const result = await post(
          serviceUrl("Verifications"),
          new URLSearchParams({ To: phoneNumber, Channel: "sms" }),
        );
        if (result?.status !== "pending")
          throw new SmsDeliveryError(
            "The SMS provider did not start a new verification. Please try again.",
          );
        return;
      }
      if (!env.TWILIO_FROM_NUMBER)
        throw new SmsDeliveryError(
          "SMS delivery is not configured. Contact Travel Bite support.",
        );
      await post(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID || "")}/Messages.json`,
        new URLSearchParams({
          To: phoneNumber,
          From: env.TWILIO_FROM_NUMBER,
          Body: `Your Travel Bite login code is ${code}. Valid for 5 minutes. Never share this code.`,
        }),
      );
    },
    // Twilio generates and atomically consumes the real SMS code. Better Auth's
    // internally generated placeholder must never be accepted in this mode.
    ...(useVerify
      ? {
          verifyOTP: async ({ phoneNumber, code }: OtpInput) => {
            if (!/^\+91[6-9]\d{9}$/.test(phoneNumber) || !/^\d{6}$/.test(code))
              return false;
            const result = await post(
              serviceUrl("VerificationCheck"),
              new URLSearchParams({ To: phoneNumber, Code: code }),
              true,
            );
            return result?.status === "approved";
          },
        }
      : {}),
  };
}
