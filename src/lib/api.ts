import { randomUUID } from "node:crypto";
import { ObjectId, MongoServerError } from "mongodb";
import { z } from "zod";
import { collections, getCatalog } from "./db";
import {
  currentUser,
  HttpError,
  requireUser,
  sameOrigin,
  readJson,
} from "./http";
import { readBody } from "./request-body";
import { checkoutSchema, foodSchema, partnerSchema } from "./validation";
import { calculateOrder, canTransition, validateArrival } from "./order-rules";
import { razorpay, verifySignature } from "./payments";
import type { BusRoute, Order, OrderStatus, Restaurant } from "./types";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const bad = (message: string): never => {
  throw new HttpError(400, message);
};
const statusSchema = z.enum([
  "accepted",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

async function rateLimit(userId: string) {
  const { db } = await collections();
  const key = `${userId}:${Math.floor(Date.now() / 60000)}`;
  const record = await db
    .collection<{ _id: string; count: number; expiresAt: Date }>("abuseLimits")
    .findOneAndUpdate(
      { _id: key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(Date.now() + 120000) },
      },
      { upsert: true, returnDocument: "after" },
    );
  if (record && record.count > 10)
    throw new HttpError(429, "Too many requests. Please wait a minute.");
}
function paymentResponse(order: Order) {
  return {
    order,
    payment:
      order.paymentMethod === "razorpay" &&
      order.paymentStatus === "pending" &&
      order.razorpayOrderId
        ? {
            key: process.env.RAZORPAY_KEY_ID,
            order_id: order.razorpayOrderId,
            amount: order.total,
            currency: "INR",
          }
        : null,
  };
}

async function createOrder(request: Request) {
  const user = await requireUser();
  if (!user.phone)
    throw new HttpError(400, "Use a mobile account to place an order.");
  await rateLimit(user.id);
  const input = checkoutSchema.parse(await readJson(request));
  const c = await collections();
  const existing = await c.orders.findOne({
    userId: user.id,
    idempotencyKey: input.idempotencyKey,
  });
  if (existing) return json(paymentResponse(existing));
  const foods = await c.foods
    .find({ _id: { $in: input.items.map((i) => i.foodId) } })
    .toArray();
  let calculated;
  try {
    calculated = calculateOrder(input.items, foods);
    validateArrival(input.journey.arrivalAt, calculated.prepMinutes);
  } catch (e) {
    bad((e as Error).message);
  }
  const { prepMinutes: _prep, ...totals } = calculated!;
  if (input.expectedTotal !== totals.total)
    throw new HttpError(
      409,
      "Menu prices changed. Review the refreshed bag and place your order again.",
    );
  const restaurant = await c.restaurants.findOne({
    _id: totals.restaurantId,
    status: "approved",
  });
  if (!restaurant) bad("This restaurant is not accepting orders.");
  const route = await c.routes.findOne({
    _id: input.journey.routeId,
    active: true,
  });
  const stop = route?.stops.find((s) => s.id === input.journey.stopId);
  if (!stop || !restaurant!.stopIds.includes(stop.id))
    bad("This restaurant doesn't deliver to your selected stop.");
  const now = new Date().toISOString();
  const order: Order = {
    _id: `TB-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
    userId: user.id,
    ...totals,
    restaurantName: restaurant!.name,
    customerName: input.customerName,
    customerPhone: user.phone,
    journey: input.journey,
    stopName: stop!.name,
    notes: input.notes,
    paymentMethod: input.paymentMethod,
    idempotencyKey: input.idempotencyKey,
    paymentStatus: input.paymentMethod === "cod" ? "cash_due" : "pending",
    status: input.paymentMethod === "cod" ? "placed" : "pending_payment",
    createdAt: now,
    updatedAt: now,
  };
  if (input.paymentMethod === "razorpay") {
    const provider = await razorpay<{ id: string }>("orders", {
      amount: order.total,
      currency: "INR",
      receipt: order._id,
      notes: { travelBiteOrder: order._id },
    });
    order.razorpayOrderId = provider.id;
  }
  try {
    await c.orders.insertOne(order);
  } catch (e) {
    if (e instanceof MongoServerError && e.code === 11000) {
      const winner = await c.orders.findOne({
        userId: user.id,
        idempotencyKey: input.idempotencyKey,
      });
      if (winner) return json(paymentResponse(winner));
    }
    throw e;
  }
  return json(paymentResponse(order), 201);
}

async function markPaid(
  razorpayOrderId: string,
  paymentId: string,
  amount: number,
  currency: string,
) {
  const c = await collections();
  const order = await c.orders.findOne({ razorpayOrderId });
  if (!order || order.total !== amount || currency !== "INR")
    throw new HttpError(400, "Payment details do not match the order.");
  await c.orders.updateOne(
    { _id: order._id, paymentStatus: "pending", status: "pending_payment" },
    {
      $set: {
        paymentStatus: "paid",
        status: "placed",
        razorpayPaymentId: paymentId,
        updatedAt: new Date().toISOString(),
      },
    },
  );
  return c.orders.findOne({ _id: order._id });
}

export async function webhook(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, "Webhook is not configured.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(
    await readBody(request, 65536),
  );
  if (
    !verifySignature(
      text,
      request.headers.get("x-razorpay-signature") || "",
      secret,
    )
  )
    throw new HttpError(401, "Invalid webhook signature.");
  const payload = JSON.parse(text);
  if (payload.event === "payment.captured") {
    const p = z
      .object({
        id: z
          .string()
          .regex(/^pay_[A-Za-z0-9_-]+$/)
          .max(128),
        order_id: z
          .string()
          .regex(/^order_[A-Za-z0-9_-]+$/)
          .max(128),
        amount: z.number().int().positive(),
        currency: z.literal("INR"),
        status: z.literal("captured"),
      })
      .parse(payload.payload?.payment?.entity);
    await markPaid(p.order_id, p.id, p.amount, p.currency);
  }
  if (payload.event === "refund.processed") {
    const r = z
      .object({
        id: z.string().min(3).max(128),
        payment_id: z.string().min(3).max(128),
        amount: z.number().int().positive(),
        status: z.literal("processed"),
      })
      .parse(payload.payload?.refund?.entity);
    if (r.status === "processed") {
      const { orders } = await collections();
      await orders.updateOne(
        {
          paymentStatus: "refund_pending",
          total: r.amount,
          razorpayPaymentId: r.payment_id,
          $or: [{ refundId: r.id }, { refundId: { $exists: false } }],
        },
        {
          $set: {
            paymentStatus: "refunded",
            refundId: r.id,
            updatedAt: new Date().toISOString(),
          },
        },
      );
    }
  }
  return json({ received: true });
}

export async function api(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api\/?/, "");
  const method = request.method;
  if (path === "payments/webhook" && method === "POST") return webhook(request);
  if (!["GET", "HEAD"].includes(method)) sameOrigin(request);

  if (path === "health" && method === "GET") {
    await (await collections()).db.command({ ping: 1 });
    return json({ status: "ok" });
  }

  if (path === "catalog" && method === "GET") return json(await getCatalog());
  if (path === "config" && method === "GET")
    return json({
      onlinePayments: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
      ),
      localSms:
        process.env.NODE_ENV !== "production" && process.env.DEV_SMS === "true",
    });
  if (path === "me" && method === "GET")
    return json({ user: await currentUser() });
  if (path === "orders" && method === "POST") return createOrder(request);
  if (path === "orders" && method === "GET") {
    const user = await requireUser();
    const { orders } = await collections();
    return json({
      orders: await orders
        .find({ userId: user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
    });
  }
  if (path === "payments/verify" && method === "POST") {
    const user = await requireUser();
    const input = z
      .object({
        orderId: z.string().max(40),
        razorpay_order_id: z.string().max(80),
        razorpay_payment_id: z.string().max(80),
        razorpay_signature: z.string().length(64),
      })
      .parse(await readJson(request));
    const { orders } = await collections();
    const order = await orders.findOne({ _id: input.orderId, userId: user.id });
    if (!order || order.razorpayOrderId !== input.razorpay_order_id)
      throw new HttpError(404, "Order not found.");
    if (
      !process.env.RAZORPAY_KEY_SECRET ||
      !verifySignature(
        `${order.razorpayOrderId}|${input.razorpay_payment_id}`,
        input.razorpay_signature,
        process.env.RAZORPAY_KEY_SECRET,
      )
    )
      bad("Payment verification failed.");
    const payment = await razorpay<{
      id: string;
      order_id: string;
      amount: number;
      currency: string;
      status: string;
    }>(`payments/${encodeURIComponent(input.razorpay_payment_id)}`);
    if (payment.order_id !== order.razorpayOrderId)
      bad("Payment order mismatch.");
    if (payment.status !== "captured")
      throw new HttpError(
        409,
        "Payment is still being confirmed. Check My orders in a moment.",
      );
    return json({
      order: await markPaid(
        payment.order_id,
        payment.id,
        payment.amount,
        payment.currency,
      ),
    });
  }
  if (/^orders\/[^/]+\/payment$/.test(path) && method === "POST") {
    const user = await requireUser();
    const { orders } = await collections();
    const order = await orders.findOne({
      _id: path.split("/")[1],
      userId: user.id,
      status: "pending_payment",
      paymentStatus: "pending",
    });
    if (!order) throw new HttpError(404, "No pending payment found.");
    if (new Date(order.journey.arrivalAt).getTime() < Date.now() + 15 * 60000)
      bad(
        "The delivery window has passed. Contact support before retrying payment.",
      );
    return json(paymentResponse(order));
  }
  if (/^orders\/[^/]+\/cancel$/.test(path) && method === "POST") {
    const user = await requireUser();
    const { orders } = await collections();
    const updated = await orders.findOneAndUpdate(
      {
        _id: path.split("/")[1],
        userId: user.id,
        paymentMethod: "cod",
        status: "placed",
      },
      { $set: { status: "cancelled", updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    if (!updated)
      throw new HttpError(
        409,
        "This order can no longer be cancelled here. Please contact support.",
      );
    return json({ order: updated });
  }
  if (path === "partner" && method === "POST") {
    const user = await requireUser();
    if (!user.phone)
      throw new HttpError(
        400,
        "Use a mobile account to register a restaurant.",
      );
    const input = partnerSchema.parse(await readJson(request));
    const c = await collections();
    if (await c.restaurants.findOne({ ownerId: user.id }))
      throw new HttpError(409, "You have already registered a restaurant.");
    const routes = await c.routes.find({ active: true }).toArray();
    const valid = new Set(routes.flatMap((r) => r.stops.map((s) => s.id)));
    if (input.stopIds.some((s) => !valid.has(s)))
      bad("Choose a supported delivery stop.");
    const restaurant: Restaurant = {
      ...input,
      _id: randomUUID(),
      image: "/images/thali.jpg",
      ownerId: user.id,
      phone: user.phone,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    try {
      await c.restaurants.insertOne(restaurant);
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000)
        throw new HttpError(409, "You have already registered a restaurant.");
      throw e;
    }
    return json({ restaurant }, 201);
  }
  if (path === "partner" && method === "GET") {
    const user = await requireUser();
    const c = await collections();
    const restaurant = await c.restaurants.findOne({ ownerId: user.id });
    const [foods, orders] = restaurant
      ? await Promise.all([
          c.foods.find({ restaurantId: restaurant._id }).toArray(),
          c.orders
            .find({
              restaurantId: restaurant._id,
              status: { $ne: "pending_payment" },
            })
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray(),
        ])
      : [[], []];
    return json({ restaurant, foods, orders });
  }
  if (path === "partner/menu" && method === "POST") {
    const user = await requireUser();
    const c = await collections();
    const restaurant = await c.restaurants.findOne({
      ownerId: user.id,
      status: { $in: ["approved", "pending"] },
    });
    if (!restaurant)
      throw new HttpError(403, "Register your restaurant first.");
    const input = foodSchema.parse(await readJson(request));
    const food = { ...input, restaurantId: restaurant._id, _id: randomUUID() };
    await c.foods.insertOne(food);
    return json({ food }, 201);
  }
  if (/^partner\/menu\/[^/]+$/.test(path) && method === "PATCH") {
    const user = await requireUser();
    const c = await collections();
    const restaurant = await c.restaurants.findOne({
      ownerId: user.id,
      status: { $in: ["approved", "pending"] },
    });
    if (!restaurant) throw new HttpError(403, "Restaurant access denied.");
    const input = foodSchema.partial().parse(await readJson(request));
    const food = await c.foods.findOneAndUpdate(
      { _id: path.split("/")[2], restaurantId: restaurant._id },
      { $set: input },
      { returnDocument: "after" },
    );
    if (!food) throw new HttpError(404, "Dish not found.");
    return json({ food });
  }
  if (/^manage\/orders\/[^/]+$/.test(path) && method === "PATCH") {
    const user = await requireUser(["admin", "restaurant"]);
    const c = await collections();
    const input = z
      .object({
        status: statusSchema,
        deliveryAgent: z.string().trim().max(80).optional(),
        deliveryPhone: z
          .string()
          .regex(/^\+91[6-9]\d{9}$/)
          .optional(),
      })
      .parse(await readJson(request));
    const order = await c.orders.findOne({ _id: path.split("/")[2] });
    if (!order) throw new HttpError(404, "Order not found.");
    if (user.role !== "admin") {
      if (
        !(await c.restaurants.findOne({
          _id: order.restaurantId,
          ownerId: user.id,
          status: "approved",
        }))
      )
        throw new HttpError(403, "You cannot manage this order.");
      if (
        ["out_for_delivery", "delivered"].includes(input.status) ||
        input.deliveryAgent ||
        input.deliveryPhone
      )
        throw new HttpError(403, "Delivery updates are managed by the admin.");
    }
    if (!canTransition(order.status, input.status))
      throw new HttpError(
        409,
        "This order has changed. Refresh and try again.",
      );
    if (input.status === "cancelled" && order.paymentStatus === "paid")
      bad("Use the refund action to cancel a paid order.");
    if (
      input.status === "out_for_delivery" &&
      (!input.deliveryAgent || !input.deliveryPhone)
    )
      bad("Add the delivery person's name and phone number.");
    const updated = await c.orders.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
      {
        $set: {
          status: input.status,
          updatedAt: new Date().toISOString(),
          ...(input.status === "delivered" && order.paymentMethod === "cod"
            ? { paymentStatus: "cash_collected" as const }
            : {}),
          ...(input.deliveryAgent
            ? {
                deliveryAgent: input.deliveryAgent,
                deliveryPhone: input.deliveryPhone,
              }
            : {}),
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) throw new HttpError(409, "Order changed. Please refresh.");
    return json({ order: updated });
  }
  if (path === "admin" && method === "GET") {
    await requireUser(["admin"]);
    const c = await collections();
    const [orders, restaurants, customers, routes, counts] = await Promise.all([
      c.orders.find().sort({ createdAt: -1 }).limit(200).toArray(),
      c.restaurants.find().toArray(),
      c.db
        .collection("user")
        .find(
          {},
          { projection: { name: 1, phoneNumber: 1, role: 1, createdAt: 1 } },
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      c.routes.find().toArray(),
      c.orders
        .aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [
                    { $in: ["$paymentStatus", ["paid", "cash_collected"]] },
                    "$total",
                    0,
                  ],
                },
              },
              active: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["placed", "accepted", "preparing", "out_for_delivery"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ]);
    return json({
      orders,
      restaurants,
      customers,
      routes,
      stats: counts[0] || { total: 0, revenue: 0, active: 0 },
      customerCount: await c.db.collection("user").countDocuments(),
    });
  }
  if (/^admin\/restaurants\/[^/]+$/.test(path) && method === "PATCH") {
    await requireUser(["admin"]);
    const c = await collections();
    const input = z
      .object({ status: z.enum(["approved", "suspended"]) })
      .parse(await readJson(request));
    const restaurant = await c.restaurants.findOneAndUpdate(
      { _id: path.split("/")[2] },
      { $set: input },
      { returnDocument: "after" },
    );
    if (!restaurant) throw new HttpError(404, "Restaurant not found.");
    if (restaurant.ownerId && input.status === "approved")
      await c.db
        .collection("user")
        .updateOne(
          { _id: new ObjectId(restaurant.ownerId), role: { $ne: "admin" } },
          { $set: { role: "restaurant" } },
        );
    return json({ restaurant });
  }
  if (path === "admin/routes" && method === "POST") {
    await requireUser(["admin"]);
    const input = z
      .object({
        name: z.string().min(3).max(100),
        active: z.boolean(),
        stops: z
          .array(
            z.object({
              id: z
                .string()
                .regex(/^[a-z0-9-]+$/)
                .max(80),
              name: z.string().min(3).max(100),
              city: z.string().min(2).max(80),
              minutes: z.number().int().min(20).max(1440),
            }),
          )
          .min(1)
          .max(30),
      })
      .parse(await readJson(request));
    if (new Set(input.stops.map((s) => s.id)).size !== input.stops.length)
      bad("Stop IDs must be unique within a route.");
    const route: BusRoute = { ...input, _id: randomUUID() };
    await (await collections()).routes.insertOne(route);
    return json({ route }, 201);
  }
  if (/^admin\/routes\/[^/]+$/.test(path) && method === "PATCH") {
    await requireUser(["admin"]);
    const input = z
      .object({ active: z.boolean() })
      .parse(await readJson(request));
    const route = await (
      await collections()
    ).routes.findOneAndUpdate(
      { _id: path.split("/")[2] },
      { $set: input },
      { returnDocument: "after" },
    );
    if (!route) throw new HttpError(404, "Route not found.");
    return json({ route });
  }
  if (/^admin\/orders\/[^/]+\/refund$/.test(path) && method === "POST") {
    await requireUser(["admin"]);
    const { orders } = await collections();
    const order = await orders.findOneAndUpdate(
      {
        _id: path.split("/")[2],
        paymentStatus: "paid",
        razorpayPaymentId: { $type: "string" },
        status: { $in: ["placed", "accepted"] },
      },
      {
        $set: {
          paymentStatus: "refund_pending",
          status: "cancelled",
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: "before" },
    );
    if (!order?.razorpayPaymentId)
      throw new HttpError(
        409,
        "This order is not eligible for a refund, or a refund is already being processed.",
      );
    // Keep the claim on network failure: a provider may have processed the refund.
    // An administrator must reconcile it in Razorpay before retrying.
    const refund = await razorpay<{ id: string; status: string }>(
      `payments/${encodeURIComponent(order.razorpayPaymentId)}/refund`,
      { amount: order.total, notes: { travelBiteOrder: order._id } },
    );
    await orders.updateOne(
      { _id: order._id, paymentStatus: "refund_pending" },
      {
        $set: {
          refundId: refund.id,
          paymentStatus:
            refund.status === "processed" ? "refunded" : "refund_pending",
          updatedAt: new Date().toISOString(),
        },
      },
    );
    return json({ success: true });
  }
  throw new HttpError(404, "Endpoint not found.");
}
