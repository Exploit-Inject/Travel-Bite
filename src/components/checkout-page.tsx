"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BusFront,
  Check,
  CreditCard,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useApp } from "./app-provider";
import { BagItems, Bill } from "./bag";
import { request } from "@/lib/client-api";
import { payForOrder, type PaymentSession } from "@/lib/checkout";
import { DELIVERY_FEE, FREE_DELIVERY_MINIMUM } from "@/lib/order-rules";

export function CheckoutPage() {
  const {
    user,
    authLoading,
    cart,
    journey,
    login,
    editJourney,
    onlinePayments,
    clearCart,
    toast,
    catalog,
    refreshCatalog,
  } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<"cod" | "razorpay">("cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef({ fingerprint: "", key: "" });
  const stop = catalog.routes
    .flatMap((r) => r.stops)
    .find((s) => s.id === journey?.stopId);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) {
      login();
      return;
    }
    if (!journey) {
      editJourney();
      return;
    }
    setBusy(true);
    try {
      const subtotal = cart.reduce(
        (n, i) =>
          n +
          (catalog.foods.find((f) => f._id === i.foodId)?.price || 0) *
            i.quantity,
        0,
      );
      const expectedTotal =
        subtotal + (subtotal >= FREE_DELIVERY_MINIMUM ? 0 : DELIVERY_FEE);
      const body = {
        items: cart,
        journey,
        customerName: name || (user.name !== "Traveller" ? user.name : ""),
        notes,
        paymentMethod: method,
        expectedTotal,
      };
      const fingerprint = JSON.stringify(body);
      if (attempt.current.fingerprint !== fingerprint)
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      const result = await request<PaymentSession>("orders", "POST", {
        ...body,
        idempotencyKey: attempt.current.key,
      });
      clearCart();
      if (result.payment) {
        try {
          await payForOrder(result);
          toast("Payment confirmed. Your kitchen has your order.");
        } catch (e) {
          toast((e as Error).message, true);
        }
      } else toast("Order placed. Your next stop is looking delicious.");
      router.push(`/orders?order=${result.order._id}`);
    } catch (e) {
      setError((e as Error).message);
      await refreshCatalog();
    } finally {
      setBusy(false);
    }
  }
  if (!cart.length && !busy)
    return (
      <div className="container page-shell">
        <div className="empty-state">
          <ShoppingBag size={50} />
          <h1>Your bag is waiting for a good meal.</h1>
          <p>Pick something delicious, then we’ll take care of the rest.</p>
          <Link href="/menu" className="button">
            Explore menu
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  return (
    <div className="container page-shell">
      <Link className="back-link" href="/menu">
        <ArrowLeft size={16} />
        Back to menu
      </Link>
      <div className="page-heading">
        <div className="eyebrow">ONE LAST STOP</div>
        <h1>Let’s get your meal on the road.</h1>
        <p>Check your details and leave the cooking to us.</p>
      </div>
      <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-steps">
          <section className="panel">
            <div className="panel-heading">
              <span className={`step-circle ${user ? "complete" : ""}`}>
                {user ? <Check size={17} /> : "1"}
              </span>
              <h2>Your details</h2>
              {user && (
                <span className="badge badge-green">
                  {user.phoneVerified ? "Mobile verified" : "Logged in"}
                </span>
              )}
            </div>
            {user ? (
              <>
                <p className="small muted">
                  <UserRound size={14} /> {user.phone}
                </p>
                <label>
                  Your name
                  <input
                    placeholder="What should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
              </>
            ) : (
              <div className="step-body">
                <p>
                  Log in with your mobile number so the delivery team can reach
                  you.
                </p>
                <button
                  className="button button-outline"
                  type="button"
                  onClick={login}
                  disabled={authLoading}
                >
                  {authLoading ? "Checking login…" : "Log in to continue"}
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span className={`step-circle ${journey ? "complete" : ""}`}>
                {journey ? <Check size={17} /> : "2"}
              </span>
              <h2>Your delivery stop</h2>
              <button
                type="button"
                className="inline-link push-right"
                onClick={editJourney}
              >
                {journey ? "Change" : "Add journey"}
              </button>
            </div>
            {journey ? (
              <div className="journey-summary">
                <div>
                  <MapPin size={20} />
                  <div>
                    <strong>{stop?.name || "Choose a valid stop"}</strong>
                    <p>
                      {new Date(journey.arrivalAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
                <div>
                  <BusFront size={20} />
                  <div>
                    <strong>
                      {journey.busNumber} · Seat {journey.seatNumber}
                    </strong>
                    <p>
                      Currently near{" "}
                      {journey.currentLocation || "location not set"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted">
                Tell us your bus, seat, and expected arrival at the stop.
              </p>
            )}
            <label className="notes-label">
              Anything the kitchen should know?
              <textarea
                placeholder="e.g. Less spicy, please. For allergies, contact the restaurant before ordering."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </label>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span className="step-circle">3</span>
              <h2>Payment, your way</h2>
            </div>
            <label
              className={`payment-option ${method === "cod" ? "chosen" : ""}`}
            >
              <input
                type="radio"
                name="payment"
                checked={method === "cod"}
                onChange={() => setMethod("cod")}
              />
              <Banknote size={25} />
              <span>
                <strong>Cash on delivery</strong>
                <small>Pay when your food reaches you.</small>
              </span>
              <span className="radio-mark" />
            </label>
            <label
              className={`payment-option ${method === "razorpay" ? "chosen" : ""} ${!onlinePayments ? "disabled" : ""}`}
            >
              <input
                type="radio"
                name="payment"
                checked={method === "razorpay"}
                disabled={!onlinePayments}
                onChange={() => setMethod("razorpay")}
              />
              <CreditCard size={25} />
              <span>
                <strong>Pay online</strong>
                <small>
                  {onlinePayments
                    ? "UPI, credit & debit cards, net banking · Razorpay"
                    : "Online payments are currently unavailable."}
                </small>
              </span>
              <span className="radio-mark" />
            </label>
          </section>
        </div>
        <aside className="checkout-bill panel">
          <h2>Your good food bag</h2>
          <BagItems />
          <Bill />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button full" disabled={busy || authLoading}>
            {busy
              ? "Placing your order…"
              : !user
                ? "Log in to place order"
                : !journey
                  ? "Add your journey"
                  : method === "cod"
                    ? "Place order"
                    : "Proceed to payment"}
            <ArrowRight size={18} />
          </button>
          <p className="secure-note">
            <ShieldCheck size={15} />
            Secure checkout. Fresh food ahead.
          </p>
          <p className="small muted">
            By placing an order you accept our{" "}
            <Link href="/legal/terms">terms</Link> and{" "}
            <Link href="/legal/refunds">cancellation policy</Link>.
          </p>
        </aside>
      </form>
    </div>
  );
}
