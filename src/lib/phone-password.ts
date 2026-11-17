import {
  APIError,
  createAuthEndpoint,
  sessionMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import type { BetterAuthPlugin } from "better-auth";

const password = z.string().min(12, "Use at least 12 characters.").max(128);
function checkOrigin(request?: Request) {
  const expected = new URL(
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ).origin;
  if (!request || request.headers.get("origin") !== expected)
    throw new APIError("FORBIDDEN", { message: "Invalid request origin." });
}
export const phonePassword = () =>
  ({
    id: "phone-password",
    endpoints: {
      registerPhonePassword: createAuthEndpoint(
        "/phone-password/sign-up",
        {
          method: "POST",
          body: z.object({
            name: z.string().trim().min(2).max(80),
            phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/),
            password,
          }),
        },
        async (ctx) => {
          checkOrigin(ctx.request);
          const { name, phoneNumber, password } = ctx.body;
          const email = `${phoneNumber.slice(1)}@phone.travelbite.invalid`;
          const hash = await ctx.context.password.hash(password);
          let user;
          try {
            user = await ctx.context.adapter.transaction(async (trx) => {
              const existing = await trx.findOne({
                model: "user",
                where: [{ field: "phoneNumber", value: phoneNumber }],
              });
              if (existing)
                throw new APIError("CONFLICT", {
                  message:
                    "An account already uses this number. Log in with your password or OTP. After OTP login, you can add a password in My account.",
                });
              const created = await trx.create<{
                id: string;
                name: string;
                email: string;
                emailVerified: boolean;
                phoneNumber: string;
                phoneNumberVerified: boolean;
                role: string;
                passwordEnabled: boolean;
                createdAt: Date;
                updatedAt: Date;
              }>({
                model: "user",
                data: {
                  name,
                  email,
                  emailVerified: false,
                  phoneNumber,
                  phoneNumberVerified: false,
                  role: "passenger",
                  passwordEnabled: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              await trx.create({
                model: "account",
                data: {
                  accountId: created.id,
                  userId: created.id,
                  providerId: "credential",
                  password: hash,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              return created;
            });
          } catch (error) {
            if (
              error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === 11000
            )
              throw new APIError("CONFLICT", {
                message:
                  "An account already uses this number. Please log in instead.",
              });
            throw error;
          }
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          );
          if (!session)
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Account created. Please log in with your password.",
            });
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ success: true });
        },
      ),
      addPhonePassword: createAuthEndpoint(
        "/phone-password/set-password",
        {
          method: "POST",
          use: [sessionMiddleware],
          body: z.object({ password }),
        },
        async (ctx) => {
          checkOrigin(ctx.request);
          const user = await ctx.context.internalAdapter.findUserById(
            ctx.context.session.user.id,
          );
          if (!user || !(user as Record<string, unknown>).phoneNumber)
            throw new APIError("FORBIDDEN", {
              message: "A mobile account is required.",
            });
          const hash = await ctx.context.password.hash(ctx.body.password);
          await ctx.context.adapter.transaction(async (trx) => {
            const existing = await trx.findOne({
              model: "account",
              where: [
                { field: "userId", value: user.id },
                { field: "providerId", value: "credential" },
              ],
            });
            if (existing)
              throw new APIError("CONFLICT", {
                message:
                  "A password is already set. Log in with it or use OTP.",
              });
            await trx.create({
              model: "account",
              data: {
                accountId: user.id,
                userId: user.id,
                providerId: "credential",
                password: hash,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            await trx.update({
              model: "user",
              where: [{ field: "id", value: user.id }],
              update: { passwordEnabled: true, updatedAt: new Date() },
            });
          });
          return ctx.json({ success: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
