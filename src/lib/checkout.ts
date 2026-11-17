import { request } from "./client-api";
import type { Order } from "./types";
export interface PaymentSession {
  order: Order;
  payment: {
    key: string;
    order_id: string;
    amount: number;
    currency: string;
  } | null;
}
type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (
        event: string,
        handler: (event: { error?: { description?: string } }) => void,
      ) => void;
    };
  }
}
let loading: Promise<void> | undefined;
async function loadCheckout() {
  if (window.Razorpay) return;
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => {
        loading = undefined;
        script.remove();
        reject(
          new Error(
            "Couldn't load secure checkout. Check your connection and try again.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  return loading;
}
export async function payForOrder(session: PaymentSession) {
  if (!session.payment)
    throw new Error("Payment is not available for this order.");
  await loadCheckout();
  return new Promise<void>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      ...session.payment,
      name: "Travel Bite",
      description: `Meal order ${session.order._id}`,
      prefill: {
        name: session.order.customerName,
        contact: session.order.customerPhone,
      },
      theme: { color: "#f2632d" },
      modal: {
        ondismiss: () =>
          reject(new Error("Payment closed. You can retry from My orders.")),
      },
      handler: async (result: RazorpayResult) => {
        try {
          await request("payments/verify", "POST", {
            orderId: session.order._id,
            ...result,
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    });
    checkout.on("payment.failed", (e) =>
      reject(
        new Error(
          e.error?.description ||
            "Payment failed. You can retry from My orders.",
        ),
      ),
    );
    checkout.open();
  });
}
