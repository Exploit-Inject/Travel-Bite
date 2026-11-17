import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex"),
  );
}
export async function razorpay<T>(path: string, body?: unknown): Promise<T> {
  const key = process.env.RAZORPAY_KEY_ID,
    secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret)
    throw new HttpError(
      503,
      "Online payment is not available yet. Please choose cash on delivery.",
    );
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok)
    throw new HttpError(
      502,
      "The payment provider couldn't complete this request. Please try again.",
    );
  return response.json() as Promise<T>;
}
