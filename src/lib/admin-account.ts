import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { z } from "zod";
import { getDb, getMongoClient } from "./db";

const credentials = z.object({
  email: z
    .email()
    .transform((value) => value.trim().toLowerCase())
    .refine(
      (value) => !value.endsWith("@phone.travelbite.invalid"),
      "Use a dedicated admin email address.",
    ),
  password: z
    .string()
    .min(12, "ADMIN_PASSWORD must contain at least 12 characters.")
    .max(128),
  name: z.string().trim().min(2).max(80).default("Travel Bite Admin"),
});

// Used only by the command-line setup and isolated tests. This auth instance is
// never mounted as an HTTP handler. Public email registration stays disabled.
export async function provisionAdmin(
  input: { email: string; password: string; name?: string },
  resetPassword = false,
) {
  const values = credentials.parse(input);
  const db = await getDb();
  const existing = await db.collection("user").findOne({ email: values.email });
  if (existing && existing.role !== "admin")
    throw new Error(
      "That email belongs to a non-admin account. Choose a separate admin email.",
    );
  const setup = betterAuth({
    database: mongodbAdapter(db, { client: await getMongoClient() }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "admin", input: false },
      },
    },
  });
  if (existing) {
    if (!resetPassword)
      return { email: values.email, created: false, reset: false };
    const context = await setup.$context;
    const id = existing._id.toString();
    const account = await context.internalAdapter.findCredentialAccount(id);
    if (!account)
      throw new Error(
        "This legacy admin has no password account. Choose a separate email for the new administrator.",
      );
    // Revoke existing sessions first; a failure leaves the password unchanged.
    await context.internalAdapter.deleteUserSessions(id);
    await context.internalAdapter.updatePassword(
      id,
      await context.password.hash(values.password),
    );
    return { email: values.email, created: false, reset: true };
  }
  await setup.api.signUpEmail({ body: values });
  return { email: values.email, created: true, reset: false };
}
