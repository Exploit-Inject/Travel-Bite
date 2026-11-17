import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { pathToFileURL } from "node:url";
import { collections } from "../src/lib/db";
import { foods, restaurants, routes } from "../src/lib/seed-data";

export async function seed() {
  const c = await collections();
  await Promise.all([
    c.orders.createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true }),
    c.orders.createIndex(
      { razorpayOrderId: 1 },
      {
        unique: true,
        partialFilterExpression: { razorpayOrderId: { $type: "string" } },
      },
    ),
    c.orders.createIndex({ restaurantId: 1, createdAt: -1 }),
    c.orders.createIndex({ userId: 1, createdAt: -1 }),
    c.restaurants.createIndex(
      { ownerId: 1 },
      {
        unique: true,
        partialFilterExpression: { ownerId: { $type: "string" } },
      },
    ),
    c.foods.createIndex({ restaurantId: 1 }),
    c.db.collection("rateLimit").createIndex({ key: 1 }, { unique: true }),
    c.db
      .collection("abuseLimits")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  for (const r of routes)
    await c.routes.updateOne(
      { _id: r._id },
      { $setOnInsert: r },
      { upsert: true },
    );
  if (
    process.env.SEED_SAMPLE_DATA === "false" ||
    (process.env.NODE_ENV === "production" &&
      process.env.SEED_SAMPLE_DATA !== "true")
  )
    return;
  for (const r of restaurants)
    await c.restaurants.updateOne(
      { _id: r._id },
      { $setOnInsert: r },
      { upsert: true },
    );
  for (const f of foods)
    await c.foods.updateOne(
      { _id: f._id },
      { $setOnInsert: f },
      { upsert: true },
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seed()
    .then(() => {
      console.info(
        "Database indexes, routes and requested seed data are ready.",
      );
      process.exit(0);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
