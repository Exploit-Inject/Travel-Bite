import { MongoClient, type Db } from "mongodb";
import type { BusRoute, Food, Order, Restaurant } from "./types";

declare global {
  var travelBiteMongo: Promise<MongoClient> | undefined;
  var travelBiteIndexes: Map<string, Promise<void>> | undefined;
}
export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri)
    throw new Error(
      "MONGODB_URI is missing. Run npm run dev for a local database, or configure MongoDB Atlas.",
    );
  if (!global.travelBiteMongo) {
    global.travelBiteMongo = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
    }).connect();
    global.travelBiteMongo.catch(() => {
      global.travelBiteMongo = undefined;
    });
  }
  return global.travelBiteMongo;
}
export async function getDb(): Promise<Db> {
  const db = (await getMongoClient()).db(
    process.env.MONGODB_DB || "travel_bite",
  );
  global.travelBiteIndexes ||= new Map();
  if (!global.travelBiteIndexes.has(db.databaseName)) {
    const setup = Promise.all([
      db
        .collection("user")
        .createIndex({ email: 1 }, { unique: true, name: "user_email_uidx" }),
      db.collection("user").createIndex(
        { phoneNumber: 1 },
        {
          unique: true,
          name: "user_phoneNumber_uidx",
          partialFilterExpression: { phoneNumber: { $gte: "" } },
        },
      ),
      db.collection("account").createIndex(
        { userId: 1, providerId: 1 },
        {
          unique: true,
          name: "credential_user_unique",
          partialFilterExpression: { providerId: "credential" },
        },
      ),
      db
        .collection("orders")
        .createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true }),
      db.collection("orders").createIndex(
        { razorpayOrderId: 1 },
        {
          unique: true,
          partialFilterExpression: { razorpayOrderId: { $type: "string" } },
        },
      ),
      db.collection("orders").createIndex({ restaurantId: 1, createdAt: -1 }),
      db.collection("orders").createIndex({ userId: 1, createdAt: -1 }),
      db.collection("restaurants").createIndex(
        { ownerId: 1 },
        {
          unique: true,
          partialFilterExpression: { ownerId: { $type: "string" } },
        },
      ),
      db
        .collection("abuseLimits")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => {});
    setup.catch(() => {
      global.travelBiteIndexes?.delete(db.databaseName);
    });
    global.travelBiteIndexes.set(db.databaseName, setup);
  }
  await global.travelBiteIndexes.get(db.databaseName);
  return db;
}
export async function collections() {
  const db = await getDb();
  return {
    db,
    foods: db.collection<Food>("foods"),
    restaurants: db.collection<Restaurant>("restaurants"),
    routes: db.collection<BusRoute>("routes"),
    orders: db.collection<Order>("orders"),
  };
}
export async function getCatalog() {
  const c = await collections();
  const restaurants = await c.restaurants
    .find(
      { status: "approved" },
      { projection: { ownerId: 0, phone: 0, license: 0, address: 0 } },
    )
    .toArray();
  const [foods, routes] = await Promise.all([
    c.foods
      .find({ restaurantId: { $in: restaurants.map((r) => r._id) } })
      .toArray(),
    c.routes.find({ active: true }).toArray(),
  ]);
  return { restaurants, foods, routes };
}
