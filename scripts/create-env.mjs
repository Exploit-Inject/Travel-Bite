import { writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const contents = `# Local settings only. This file must never be committed.
MONGODB_URI=
MONGODB_DB=travel_bite
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}
DEV_SMS=true
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=Travel Bite Admin
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_FROM_NUMBER=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
SUPPORT_EMAIL=
SEED_SAMPLE_DATA=true
`;
try {
  await writeFile(".env.local", contents, { flag: "wx", mode: 0o600 });
  console.info(
    "Created ignored .env.local with a random authentication secret. Add your own service settings privately.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.info("Existing .env.local preserved.");
}
