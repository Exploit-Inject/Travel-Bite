import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateOrder,
  canTransition,
  validateArrival,
} from "../src/lib/order-rules";
import { checkoutSchema, foodSchema } from "../src/lib/validation";
import { foods } from "../src/lib/seed-data";

test("server prices determine the total, including the delivery fee", () => {
  const result = calculateOrder(
    [{ foodId: "royal-veg-thali", quantity: 2 }],
    foods,
  );
  assert.equal(result.subtotal, 49800);
  assert.equal(result.deliveryFee, 2900);
  assert.equal(result.total, 52700);
});
test("delivery is free when the item total reaches the threshold", () => {
  const result = calculateOrder(
    [{ foodId: "chicken-biryani", quantity: 2 }],
    foods,
  );
  assert.equal(result.subtotal, 57800);
  assert.equal(result.deliveryFee, 0);
});
test("orders reject multiple restaurants, duplicate dishes and unavailable dishes", () => {
  assert.throws(
    () =>
      calculateOrder(
        [
          { foodId: "samosa", quantity: 1 },
          { foodId: "royal-veg-thali", quantity: 1 },
        ],
        foods,
      ),
    /one restaurant/,
  );
  assert.throws(
    () =>
      calculateOrder(
        [
          { foodId: "samosa", quantity: 1 },
          { foodId: "samosa", quantity: 1 },
        ],
        foods,
      ),
    /Duplicate/,
  );
  assert.throws(
    () => calculateOrder([{ foodId: "gone", quantity: 1 }], foods),
    /no longer available/,
  );
  assert.throws(
    () =>
      calculateOrder(
        [{ foodId: "samosa", quantity: 1 }],
        foods.map((f) => ({ ...f, available: false })),
      ),
    /no longer available/,
  );
});
test("orders reject invalid quantities and empty bags", () => {
  for (const quantity of [0, -1, 1.5, 21, NaN])
    assert.throws(
      () => calculateOrder([{ foodId: "samosa", quantity }], foods),
      /quantity/,
    );
  assert.throws(() => calculateOrder([], foods), /empty/);
});
test("delivery timing includes preparation plus the handoff buffer", () => {
  const now = Date.UTC(2026, 10, 17, 10);
  assert.throws(
    () => validateArrival(new Date(now + 29 * 60000).toISOString(), 20, now),
    /30 minutes/,
  );
  assert.doesNotThrow(() =>
    validateArrival(new Date(now + 30 * 60000).toISOString(), 20, now),
  );
  assert.throws(
    () =>
      validateArrival(new Date(now + 25 * 60 * 60000).toISOString(), 20, now),
    /within 24/,
  );
  assert.throws(() => validateArrival("invalid", 20, now), /Choose an arrival/);
});
test("order transitions prevent skipping preparation or reviving cancelled orders", () => {
  assert.equal(canTransition("placed", "accepted"), true);
  assert.equal(canTransition("accepted", "preparing"), true);
  assert.equal(canTransition("preparing", "out_for_delivery"), true);
  assert.equal(canTransition("out_for_delivery", "delivered"), true);
  assert.equal(canTransition("placed", "delivered"), false);
  assert.equal(canTransition("cancelled", "placed"), false);
  assert.equal(canTransition("delivered", "preparing"), false);
});
test("untrusted checkout fields do not become order authority", () => {
  const result = checkoutSchema.parse({
    items: [{ foodId: "royal-veg-thali", quantity: 1, price: 1 }],
    journey: {
      routeId: "delhi-jaipur",
      busNumber: "DL 01 AB 1234",
      seatNumber: "12A",
      currentLocation: "Delhi",
      stopId: "behror",
      arrivalAt: new Date(Date.now() + 120 * 60000).toISOString(),
    },
    customerName: "Test Traveller",
    paymentMethod: "cod",
    idempotencyKey: crypto.randomUUID(),
    expectedTotal: 27800,
    total: 1,
    paymentStatus: "paid",
    role: "admin",
  });
  assert.equal("total" in result, false);
  assert.equal("price" in result.items[0], false);
  assert.equal("role" in result, false);
});
test("dish photos reject active URL schemes and insecure remote URLs", () => {
  const food = foods[0];
  assert.equal(
    foodSchema.safeParse({ ...food, image: "javascript:alert(1)" }).success,
    false,
  );
  assert.equal(
    foodSchema.safeParse({ ...food, image: "http://unsafe.example/photo.jpg" })
      .success,
    false,
  );
  assert.equal(
    foodSchema.safeParse({ ...food, image: "https://example.com/photo.jpg" })
      .success,
    true,
  );
});
