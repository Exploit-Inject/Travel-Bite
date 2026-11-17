import { z } from "zod";
export const journeySchema = z.object({
  routeId: z.string().min(1).max(80),
  busNumber: z.string().trim().min(4, "Enter your bus number.").max(24),
  seatNumber: z.string().trim().min(1, "Enter your seat number.").max(12),
  currentLocation: z
    .string()
    .trim()
    .min(2, "Enter your current location.")
    .max(120),
  stopId: z.string().min(1, "Choose your delivery stop.").max(80),
  arrivalAt: z.iso.datetime(),
});
export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        foodId: z.string().min(1).max(80),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(30),
  journey: journeySchema,
  customerName: z.string().trim().min(2, "Enter your name.").max(80),
  notes: z.string().trim().max(500).default(""),
  paymentMethod: z.enum(["cod", "razorpay"]),
  idempotencyKey: z.uuid(),
  expectedTotal: z.number().int().min(100).max(100000000),
});
export const partnerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(500),
  cuisine: z.string().trim().min(2).max(100),
  address: z.string().trim().min(8).max(300),
  license: z
    .string()
    .regex(/^\d{14}$/, "Enter your 14-digit FSSAI licence number."),
  stopIds: z.array(z.string().min(1).max(80)).min(1).max(20),
});
export const foodSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(300),
  category: z.enum(["Meals", "Biryani", "Snacks", "South Indian", "Beverages"]),
  price: z.number().int().min(100).max(100000),
  image: z.string().refine((v) => {
    if (/^\/images\/[a-z0-9-]+\.jpg$/.test(v)) return true;
    try {
      const url = new URL(v);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use an HTTPS image URL."),
  veg: z.boolean(),
  available: z.boolean(),
  prepMinutes: z.number().int().min(5).max(120),
  popular: z.boolean().default(false),
});
