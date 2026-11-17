import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { phoneNumber } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDb, getMongoClient } from "./db";
import { APIError } from "better-auth/api";
import { createPhoneOtpProvider, SmsDeliveryError } from "./phone-otp";
import { phonePassword } from "./phone-password";
import { authSettings } from "./config";

const createAuth = async () => {
  const db = await getDb();
  const settings = authSettings();
  const otp = createPhoneOtpProvider();
  async function deliver<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof SmsDeliveryError)
        throw new APIError(
          error.rateLimited ? "TOO_MANY_REQUESTS" : "SERVICE_UNAVAILABLE",
          { message: error.message },
        );
      throw error;
    }
  }
  return betterAuth({
    database: mongodbAdapter(db, { client: await getMongoClient() }),
    baseURL: settings.origin,
    secret: settings.secret,
    trustedOrigins: [settings.origin],
    advanced: {
      useSecureCookies: settings.secureCookies,
      ...(process.env.VERCEL
        ? { ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] } }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "passenger", input: false },
        passwordEnabled: { type: "boolean", defaultValue: false, input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/phone-number/send-otp": { window: 60, max: 3 },
        "/phone-number/verify": { window: 60, max: 5 },
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-in/phone-number": { window: 60, max: 5 },
        "/phone-password/sign-up": { window: 60, max: 3 },
        "/phone-password/set-password": { window: 60, max: 3 },
      },
    },
    plugins: [
      phoneNumber({
        otpLength: 6,
        expiresIn: otp.expiresIn,
        allowedAttempts: 5,
        phoneNumberValidator: (value) => /^\+91[6-9]\d{9}$/.test(value),
        sendOTP: (data) => deliver(() => otp.sendOTP(data)),
        ...(otp.verifyOTP
          ? {
              verifyOTP: (data: { phoneNumber: string; code: string }) =>
                deliver(() => otp.verifyOTP!(data)),
            }
          : {}),
        signUpOnVerification: {
          getTempEmail: (phone) =>
            `${phone.replace("+", "")}@phone.travelbite.invalid`,
          getTempName: () => "Traveller",
        },
      }),
      phonePassword(),
      nextCookies(),
    ],
  });
};
let authPromise: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (!authPromise) {
    authPromise = createAuth();
    authPromise.catch(() => {
      authPromise = undefined;
    });
  }
  return authPromise;
}
