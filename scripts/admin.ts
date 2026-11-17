import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { provisionAdmin } from "../src/lib/admin-account";
import { readFile } from "node:fs/promises";
if (process.argv.slice(2).some((arg) => arg !== "--reset-password")) {
  console.error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local, then run npm run admin. To rotate an existing admin password, use npm run admin -- --reset-password.",
  );
  process.exit(1);
}
if (!process.env.MONGODB_URI && process.env.NODE_ENV !== "production") {
  try {
    const local = JSON.parse(await readFile(".data/local-db.json", "utf8"));
    if (/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(local.uri)) {
      process.env.MONGODB_URI = local.uri;
      process.env.MONGODB_DB ||= local.database;
    }
  } catch {
    /* A configured MongoDB URI is required when no local runner exists. */
  }
}
try {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in .env.local or your secret manager, then run npm run admin.",
    );
  const result = await provisionAdmin(
    {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME,
    },
    process.argv.includes("--reset-password"),
  );
  console.info(
    result.created
      ? "Dedicated admin account created. Sign in at /admin/login with the configured ADMIN_EMAIL and ADMIN_PASSWORD."
      : result.reset
        ? "Admin password updated and previous sessions revoked. Sign in at /admin/login."
        : "Admin account already exists. Its password was left unchanged. To rotate it, run npm run admin -- --reset-password.",
  );
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Admin setup failed.");
  process.exit(1);
}
