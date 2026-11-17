import {
  test,
  expect,
  request as createRequest,
  type APIRequestContext,
} from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { createHmac, randomUUID } from "node:crypto";
import { testAdmin } from "../fixtures/admin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
const origin = "http://localhost:3100";
const mongo = new MongoClient(
  "mongodb://127.0.0.1:27028/?replicaSet=travelbiteTest",
);
const db = mongo.db("travel_bite_e2e");
const headers = { Origin: origin };
test.describe.configure({ mode: "serial" });
let passenger: APIRequestContext,
  other: APIRequestContext,
  partner: APIRequestContext,
  admin: APIRequestContext;
let partnerId: string, ownedFoodId: string, orderId: string;
async function otp(phone: string) {
  const record = await db
    .collection("verification")
    .findOne(
      { identifier: { $regex: phone.replace(/\+/g, "\\+") } },
      { sort: { createdAt: -1 } },
    );
  if (!record) throw new Error("Test OTP not found");
  return String(record.value).split(":")[0];
}
async function login(phone: string) {
  // Each fixture represents a separate user; reset IP-wide limits only in this
  // isolated database so fixture setup doesn't exhaust the real OTP limiter.
  await db.collection("rateLimit").deleteMany({});
  const api = await createRequest.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  const send = await api.post("/api/auth/phone-number/send-otp", {
    data: { phoneNumber: phone },
  });
  expect(send.ok(), await send.text()).toBeTruthy();
  const verify = await api.post("/api/auth/phone-number/verify", {
    data: { phoneNumber: phone, code: await otp(phone) },
  });
  expect(verify.ok(), await verify.text()).toBeTruthy();
  return api;
}
const checkout = (extra: Record<string, unknown> = {}) => ({
  items: [{ foodId: "royal-veg-thali", quantity: 1 }],
  journey: {
    routeId: "delhi-jaipur",
    busNumber: "DL 01 AB 1234",
    seatNumber: "12A",
    currentLocation: "Delhi",
    stopId: "behror",
    arrivalAt: new Date(Date.now() + 120 * 60000).toISOString(),
  },
  customerName: "Integration Traveller",
  paymentMethod: "cod",
  idempotencyKey: randomUUID(),
  expectedTotal: 27800,
  ...extra,
});
test.beforeAll(async () => {
  await mongo.connect();
  passenger = await login("+919810000001");
  other = await login("+919810000002");
  partner = await login("+919810000003");
  admin = await createRequest.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  const signIn = await admin.post("/api/auth/sign-in/email", {
    data: testAdmin,
  });
  expect(signIn.ok(), await signIn.text()).toBeTruthy();
});
test.afterAll(async () => {
  await Promise.all([
    passenger?.dispose(),
    other?.dispose(),
    partner?.dispose(),
    admin?.dispose(),
  ]);
  await mongo.close();
});

test("public catalog excludes private restaurant information; unauthenticated APIs reject access", async ({
  request,
}) => {
  const result = await request.get("/api/catalog");
  expect(result.ok()).toBeTruthy();
  const catalog = await result.json();
  expect(catalog.foods.length).toBeGreaterThan(0);
  expect(catalog.restaurants[0]).not.toHaveProperty("phone");
  expect(catalog.restaurants[0]).not.toHaveProperty("ownerId");
  expect((await request.get("/api/orders")).status()).toBe(401);
  expect((await request.get("/api/admin")).status()).toBe(401);
  expect((await passenger.get("/api/admin")).status()).toBe(403);
});
test("order creation ignores browser prices and concurrent retries create one order", async () => {
  const body = checkout({
    total: 1,
    userId: "fake",
    paymentStatus: "paid",
    items: [{ foodId: "royal-veg-thali", quantity: 1, price: 1 }],
  });
  const responses = await Promise.all([
    passenger.post("/api/orders", { data: body }),
    passenger.post("/api/orders", { data: body }),
  ]);
  for (const response of responses)
    expect(response.ok(), await response.text()).toBeTruthy();
  const first = await responses[0].json(),
    second = await responses[1].json();
  orderId = first.order._id;
  expect(first.order.total).toBe(27800);
  expect(first.order.paymentStatus).toBe("cash_due");
  expect(first.order.customerPhone).toBe("+919810000001");
  expect(second.order._id).toBe(orderId);
  expect(
    await db
      .collection("orders")
      .countDocuments({ idempotencyKey: body.idempotencyKey }),
  ).toBe(1);
  const outsider = await other.get("/api/orders");
  expect(
    (await outsider.json()).orders.some(
      (o: { _id: string }) => o._id === orderId,
    ),
  ).toBe(false);
});
test("checkout rejects invalid stops, near arrivals, mixed restaurants and missing payment configuration", async () => {
  const body = checkout();
  expect(
    (
      await passenger.post("/api/orders", {
        data: checkout({ journey: { ...body.journey, stopId: "agra" } }),
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await passenger.post("/api/orders", {
        data: checkout({
          journey: {
            ...body.journey,
            arrivalAt: new Date(Date.now() + 60000).toISOString(),
          },
        }),
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await passenger.post("/api/orders", {
        data: checkout({
          items: [
            { foodId: "samosa", quantity: 1 },
            { foodId: "royal-veg-thali", quantity: 1 },
          ],
        }),
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await other.post("/api/orders", {
        data: checkout({ paymentMethod: "razorpay" }),
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await other.post("/api/orders", {
        data: checkout({ expectedTotal: 100 }),
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await passenger.post("/api/orders", {
        headers: { Origin: "https://other.example" },
        data: checkout(),
      })
    ).status(),
  ).toBe(403);
});
test("partner onboarding requires approval and menu ownership is enforced", async () => {
  const response = await partner.post("/api/partner", {
    data: {
      name: "Test Kitchen",
      description: "Fresh food from an integration test kitchen.",
      cuisine: "North Indian",
      address: "Test Road, Behror, Rajasthan",
      license: "12345678901234",
      stopIds: ["behror"],
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  partnerId = (await response.json()).restaurant._id;
  const dish = await partner.post("/api/partner/menu", {
    data: {
      name: "Test Dal Bowl",
      description: "Dal and fresh steamed rice",
      category: "Meals",
      price: 15000,
      image: "/images/thali.jpg",
      veg: true,
      available: true,
      prepMinutes: 15,
    },
  });
  expect(dish.status(), await dish.text()).toBe(201);
  ownedFoodId = (await dish.json()).food._id;
  let catalog = await (await partner.get("/api/catalog")).json();
  expect(
    catalog.foods.some((f: { _id: string }) => f._id === ownedFoodId),
  ).toBe(false);
  expect(
    (
      await admin.patch(`/api/admin/restaurants/${partnerId}`, {
        data: { status: "approved" },
      })
    ).ok(),
  ).toBeTruthy();
  catalog = await (await partner.get("/api/catalog")).json();
  expect(
    catalog.foods.some((f: { _id: string }) => f._id === ownedFoodId),
  ).toBe(true);
  expect(
    (
      await partner.patch("/api/partner/menu/royal-veg-thali", {
        data: { price: 100 },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.patch(`/api/partner/menu/${ownedFoodId}`, {
        data: { price: 100 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await partner.patch(`/api/manage/orders/${orderId}`, {
        data: { status: "accepted" },
      })
    ).status(),
  ).toBe(403);
});
test("delivery state changes require a valid sequence, admin access and delivery details", async () => {
  expect(
    (
      await admin.patch(`/api/manage/orders/${orderId}`, {
        data: { status: "delivered" },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await admin.patch(`/api/manage/orders/${orderId}`, {
        data: { status: "accepted" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await passenger.post(`/api/orders/${orderId}/cancel`, { data: {} })
    ).status(),
  ).toBe(409);
  expect(
    (
      await admin.patch(`/api/manage/orders/${orderId}`, {
        data: { status: "preparing" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await admin.patch(`/api/manage/orders/${orderId}`, {
        data: { status: "out_for_delivery" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await admin.patch(`/api/manage/orders/${orderId}`, {
        data: {
          status: "out_for_delivery",
          deliveryAgent: "Test Delivery",
          deliveryPhone: "+919810000099",
        },
      })
    ).ok(),
  ).toBeTruthy();
  const delivered = await admin.patch(`/api/manage/orders/${orderId}`, {
    data: { status: "delivered" },
  });
  expect(delivered.ok()).toBeTruthy();
  expect((await delivered.json()).order.paymentStatus).toBe("cash_collected");
  expect(
    (
      await admin.patch(`/api/manage/orders/${orderId}`, {
        data: { status: "preparing" },
      })
    ).status(),
  ).toBe(409);
});
test("signed payment webhooks validate amount and remain idempotent after fulfillment advances", async ({
  request,
}) => {
  const original = await db
    .collection("orders")
    .findOne({ _id: orderId as unknown as ObjectId });
  const paymentOrderId = "TB-TEST-ONLINE";
  await db.collection("orders").insertOne({
    ...original,
    _id: paymentOrderId as unknown as ObjectId,
    idempotencyKey: randomUUID(),
    razorpayOrderId: "order_test_provider",
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    status: "pending_payment",
  });
  const payload = (amount: number) =>
    JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test_provider",
            order_id: "order_test_provider",
            amount,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });
  const post = (body: string, signature?: string) =>
    request.post("/api/payments/webhook", {
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature":
          signature ||
          createHmac("sha256", "travel-bite-test-webhook-secret")
            .update(body)
            .digest("hex"),
      },
      data: body,
    });
  expect((await post(payload(27800), "0".repeat(64))).status()).toBe(401);
  expect((await post(payload(1))).status()).toBe(400);
  expect((await post(payload(27800))).ok()).toBeTruthy();
  expect(
    (
      await db
        .collection("orders")
        .findOne({ _id: paymentOrderId as unknown as ObjectId })
    )?.paymentStatus,
  ).toBe("paid");
  await db
    .collection("orders")
    .updateOne(
      { _id: paymentOrderId as unknown as ObjectId },
      { $set: { status: "preparing" } },
    );
  expect((await post(payload(27800))).ok()).toBeTruthy();
  expect(
    (
      await db
        .collection("orders")
        .findOne({ _id: paymentOrderId as unknown as ObjectId })
    )?.status,
  ).toBe("preparing");
});
test("mobile passenger can scan a seat link, log in and complete a cash order", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "/menu?route=delhi-jaipur&bus=DL01AB1234&seat=12A&stop=behror",
  );
  const journey = page.getByRole("dialog", { name: "Your journey, your meal" });
  await expect(journey).toBeVisible();
  await journey.getByLabel("Current location", { exact: true }).fill("Delhi");
  await journey.getByRole("button", { name: "Find food on my route" }).click();
  await expect(journey).not.toBeVisible();
  await page
    .getByRole("button", { name: "Add Royal Veg Thali to bag", exact: true })
    .click();
  await page.getByRole("button", { name: "Open food bag, 1 items" }).click();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await page
    .getByRole("button", { name: "Log in to continue", exact: true })
    .click();
  await page.getByLabel("Mobile number", { exact: false }).fill("9810000005");
  await page.getByRole("button", { name: "Get verification code" }).click();
  await expect(
    page.getByLabel("Verification code", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Verification code", { exact: true })
    .fill(await otp("+919810000005"));
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(
    page.getByRole("dialog", { name: "Check your terminal" }),
  ).not.toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Mobile Traveller");
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page).toHaveURL(/\/orders/);
  await expect(
    page.getByText("The Spice Route", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/mobile-orders.png",
    fullPage: true,
  });
});
test("desktop and mobile home render without broken images or horizontal overflow", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Your journey. A delicious upgrade." }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((r) => {
                img.onload = r;
                img.onerror = r;
              }),
        ),
      );
    });
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
    );
    expect(broken).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  }
});
test("admin workspace renders and generates a seat QR code", async ({
  page,
  context,
}) => {
  await context.addCookies((await admin.storageState()).cookies);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Total orders", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Seat QR codes", exact: true })
    .click();
  await page.getByLabel("Bus number", { exact: true }).fill("DL01AB1234");
  await page.getByLabel("Seat number", { exact: true }).fill("12A");
  await expect(
    page.getByRole("img", { name: "Menu QR for bus DL01AB1234, seat 12A" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download seat QR" }),
  ).toHaveAttribute("download", /travel-bite/);
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "PHONE NUMBER" }),
  ).toBeVisible();
});

test("dedicated admin login rejects incorrect credentials and public registration", async ({
  page,
  request,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back, admin." }),
  ).toBeVisible();
  await page.getByLabel("Admin email", { exact: true }).fill(testAdmin.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("An-incorrect-password!");
  await page.getByRole("button", { name: "Sign in to dashboard" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "The email or password is incorrect.",
  );
  expect((await request.get("/api/admin")).status()).toBe(401);
  const signup = await request.post("/api/auth/sign-up/email", {
    headers,
    data: {
      name: "Uninvited Admin",
      email: "uninvited@travelbite.test",
      password: "Uninvited-password-123!",
      role: "admin",
    },
  });
  expect(signup.status()).toBe(400);
  expect(
    await db.collection("user").findOne({ email: "uninvited@travelbite.test" }),
  ).toBeNull();
  await page.getByLabel("Password", { exact: true }).fill(testAdmin.password);
  await page.getByRole("button", { name: "Sign in to dashboard" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const record = await db
    .collection("user")
    .findOne({ email: testAdmin.email });
  expect(record?.role).toBe("admin");
  expect(record?.phoneNumber).toBeUndefined();
  const credential = await db
    .collection("account")
    .findOne({ userId: record!._id, providerId: "credential" });
  expect(credential?.password).toBeTruthy();
  expect(credential?.password).not.toBe(testAdmin.password);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("admin setup is repeatable and password rotation revokes existing sessions", async () => {
  const execute = promisify(execFile);
  const env = {
    ...process.env,
    MONGODB_URI: "mongodb://127.0.0.1:27028/?replicaSet=travelbiteTest",
    MONGODB_DB: "travel_bite_e2e",
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: "travel-bite-e2e-only-secret-never-use-in-production",
    ADMIN_EMAIL: testAdmin.email,
    ADMIN_PASSWORD: "Rotated-test-password-2026!",
  };
  const run = (args: string[] = []) =>
    execute(
      process.execPath,
      [resolve("node_modules/tsx/dist/cli.mjs"), "scripts/admin.ts", ...args],
      { env, timeout: 30000 },
    );
  const unchanged = await run();
  expect(unchanged.stdout).toContain("password was left unchanged");
  const original = await createRequest.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  try {
    const signIn = await original.post("/api/auth/sign-in/email", {
      data: testAdmin,
    });
    expect(signIn.ok()).toBeTruthy();
    const reset = await run(["--reset-password"]);
    expect(reset.stdout).toContain("previous sessions revoked");
    expect((await original.get("/api/admin")).status()).toBe(401);
    await db.collection("rateLimit").deleteMany({});
    expect(
      (
        await original.post("/api/auth/sign-in/email", { data: testAdmin })
      ).status(),
    ).toBe(401);
    const updated = await original.post("/api/auth/sign-in/email", {
      data: { email: testAdmin.email, password: env.ADMIN_PASSWORD },
    });
    expect(updated.ok(), await updated.text()).toBeTruthy();
    expect((await original.get("/api/admin")).ok()).toBeTruthy();
  } finally {
    await original.dispose();
  }
});
test("partner workspace edits only its menu through the browser", async ({
  page,
  context,
}) => {
  await context.addCookies((await partner.storageState()).cookies);
  await page.goto("/partner/dashboard");
  await expect(
    page.getByRole("heading", { name: "Test Kitchen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My menu", exact: true }).click();
  await page.getByRole("button", { name: "Edit Test Dal Bowl" }).click();
  await page.getByLabel("Price in rupees").fill("159");
  await page.getByRole("button", { name: "Save dish", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "₹159", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark unavailable: Test Dal Bowl" })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark available: Test Dal Bowl" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/partner-menu.png",
    fullPage: true,
  });
});
test("password registration preserves roles and permits ordering without claiming phone verification", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page
    .getByRole("button", { name: "Login with password", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Login with password" });
  await dialog
    .getByLabel("Full name", { exact: true })
    .fill("Password Traveller");
  await dialog.getByLabel("Mobile number").fill("9810000010");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("Customer-test-password-2026!");
  await dialog
    .getByLabel("Confirm password", { exact: true })
    .fill("Customer-test-password-2026!");
  await dialog
    .getByRole("button", { name: "Create account & continue" })
    .click();
  await expect(dialog).not.toBeVisible();
  const me = await (await page.request.get("/api/me")).json();
  expect(me.user.name).toBe("Password Traveller");
  expect(me.user.role).toBe("passenger");
  expect(me.user.phoneVerified).toBe(false);
  const placed = await page.request.post("/api/orders", {
    headers,
    data: checkout(),
  });
  expect(placed.status(), await placed.text()).toBe(201);
  const unauthenticated = await createRequest.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  try {
    expect(
      (
        await unauthenticated.post("/api/auth/sign-in/phone-number", {
          data: { phoneNumber: "+919810000010", password: "Wrong-password!" },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await unauthenticated.post("/api/auth/phone-password/sign-up", {
          data: {
            name: "Takeover",
            phoneNumber: "+919810000001",
            password: "Takeover-password-2026!",
            role: "admin",
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await unauthenticated.post("/api/auth/phone-password/set-password", {
          data: { password: "Takeover-password-2026!" },
        })
      ).status(),
    ).toBe(401);
    const signed = await unauthenticated.post(
      "/api/auth/sign-in/phone-number",
      {
        data: {
          phoneNumber: "+919810000010",
          password: "Customer-test-password-2026!",
        },
      },
    );
    expect(signed.ok(), await signed.text()).toBeTruthy();
    const record = await db
      .collection("user")
      .findOne({ phoneNumber: "+919810000010" });
    expect(record?.phoneNumberVerified).toBe(false);
    const account = await db
      .collection("account")
      .findOne({ userId: record!._id, providerId: "credential" });
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toBe("Customer-test-password-2026!");
    await unauthenticated.post("/api/auth/sign-out", { data: {} });
    await page.goto("/account");
    await expect(
      page.getByText("Password account", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/password-account-mobile.png",
      fullPage: true,
    });
  } finally {
    await unauthenticated.dispose();
  }
});

test("an existing OTP user can add a password only to their own account", async () => {
  const added = await passenger.post("/api/auth/phone-password/set-password", {
    data: {
      password: "Existing-passenger-password-2026!",
      userId: "someone-else",
      role: "admin",
    },
  });
  expect(added.ok(), await added.text()).toBeTruthy();
  expect(
    (
      await passenger.post("/api/auth/phone-password/set-password", {
        data: { password: "Overwrite-attempt-password!" },
      })
    ).status(),
  ).toBe(409);
  const session = await createRequest.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  try {
    const login = await session.post("/api/auth/sign-in/phone-number", {
      data: {
        phoneNumber: "+919810000001",
        password: "Existing-passenger-password-2026!",
      },
    });
    expect(login.ok(), await login.text()).toBeTruthy();
    const me = await (await session.get("/api/me")).json();
    expect(me.user.role).toBe("passenger");
    expect(me.user.phoneVerified).toBe(true);
    expect(me.user.passwordEnabled).toBe(true);
  } finally {
    await session.dispose();
  }
});

test("oversized auth and order requests are rejected and private responses cannot be cached", async ({
  request,
}) => {
  const auth = await request.post("/api/auth/sign-in/email", {
    headers,
    data: { email: "test@example.com", password: "x".repeat(17000) },
  });
  expect(auth.status()).toBe(413);
  const order = await other.post("/api/orders", {
    data: { ...checkout(), extra: "x".repeat(33000) },
  });
  expect(order.status()).toBe(413);
  const me = await passenger.get("/api/me");
  expect(me.headers()["cache-control"]).toContain("no-store");
  expect(me.headers()["x-content-type-options"]).toBe("nosniff");
});

test("refund webhooks require the full amount and handle an early provider callback", async ({
  request,
}) => {
  const original = await db
    .collection("orders")
    .findOne({ _id: orderId as unknown as ObjectId });
  const refundOrderId = "TB-TEST-REFUND" as unknown as ObjectId;
  await db.collection("orders").insertOne({
    ...original,
    _id: refundOrderId,
    idempotencyKey: randomUUID(),
    razorpayOrderId: "order_refund_provider",
    razorpayPaymentId: "pay_refund_test",
    paymentMethod: "razorpay",
    paymentStatus: "refund_pending",
    status: "cancelled",
  });
  const send = async (amount: number) => {
    const body = JSON.stringify({
      event: "refund.processed",
      payload: {
        refund: {
          entity: {
            id: "rfnd_provider_test",
            payment_id: "pay_refund_test",
            amount,
            status: "processed",
          },
        },
      },
    });
    return request.post("/api/payments/webhook", {
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": createHmac(
          "sha256",
          "travel-bite-test-webhook-secret",
        )
          .update(body)
          .digest("hex"),
      },
      data: body,
    });
  };
  expect((await send(1)).ok()).toBeTruthy();
  expect(
    (await db.collection("orders").findOne({ _id: refundOrderId }))
      ?.paymentStatus,
  ).toBe("refund_pending");
  expect((await send(27800)).ok()).toBeTruthy();
  const refunded = await db
    .collection("orders")
    .findOne({ _id: refundOrderId });
  expect(refunded?.paymentStatus).toBe("refunded");
  expect(refunded?.refundId).toBe("rfnd_provider_test");
  expect((await send(27800)).ok()).toBeTruthy();
  expect(
    (await db.collection("orders").findOne({ _id: refundOrderId }))?.updatedAt,
  ).toBe(refunded?.updatedAt);
});

test("OTP codes cannot be replayed and verification cannot assign privileged roles", async ({
  request,
}) => {
  await db.collection("rateLimit").deleteMany({});
  const phoneNumber = "+919810000006";
  const sent = await request.post("/api/auth/phone-number/send-otp", {
    headers,
    data: { phoneNumber },
  });
  expect(sent.ok(), await sent.text()).toBeTruthy();
  const code = await otp(phoneNumber);
  const verified = await request.post("/api/auth/phone-number/verify", {
    headers,
    data: { phoneNumber, code, role: "admin" },
  });
  expect(verified.ok(), await verified.text()).toBeTruthy();
  const me = await (await request.get("/api/me")).json();
  expect(me.user.role).toBe("passenger");
  const replay = await request.post("/api/auth/phone-number/verify", {
    headers,
    data: { phoneNumber, code },
  });
  expect(replay.status()).toBe(400);
  await db.collection("rateLimit").deleteMany({});
  for (let i = 0; i < 3; i++)
    expect(
      (
        await request.post("/api/auth/phone-number/send-otp", {
          headers,
          data: { phoneNumber },
        })
      ).ok(),
    ).toBeTruthy();
  expect(
    (
      await request.post("/api/auth/phone-number/send-otp", {
        headers,
        data: { phoneNumber },
      })
    ).status(),
  ).toBe(429);
});
