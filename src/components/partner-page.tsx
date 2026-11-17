"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ChefHat, MapPin, ShoppingBag, Store } from "lucide-react";
import { useApp } from "./app-provider";
import { request } from "@/lib/client-api";
import type { Restaurant } from "@/lib/types";

function Registration() {
  const { catalog, user, login, toast } = useApp();
  const [existing, setExisting] = useState<Restaurant | null>(null);
  const [checking, setChecking] = useState(false);
  const [stopIds, setStopIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!user) {
      setExisting(null);
      return;
    }
    setChecking(true);
    request<{ restaurant: Restaurant | null }>("partner")
      .then((r) => setExisting(r.restaurant))
      .catch((e) => setError(e.message))
      .finally(() => setChecking(false));
  }, [user]);
  const stops = [
    ...new Map(
      catalog.routes.flatMap((r) => r.stops).map((s) => [s.id, s]),
    ).values(),
  ];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      login();
      return;
    }
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const result = await request<{ restaurant: Restaurant }>(
        "partner",
        "POST",
        {
          name: data.get("name"),
          description: data.get("description"),
          cuisine: data.get("cuisine"),
          address: data.get("address"),
          license: data.get("license"),
          stopIds,
        },
      );
      setExisting(result.restaurant);
      toast(
        "Application received. You can start adding your menu while we review it.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <div className="partner-form panel">
        <p className="muted">Checking your application…</p>
      </div>
    );
  if (existing)
    return (
      <div className="partner-form panel">
        <span
          className={`badge ${existing.status === "approved" ? "badge-green" : "badge-orange"}`}
        >
          {existing.status}
        </span>
        <h2 style={{ marginTop: 16 }}>
          {existing.name}, welcome to the table.
        </h2>
        <p className="muted">
          {existing.status === "approved"
            ? "Your restaurant is approved. Manage dishes and incoming orders in your workspace."
            : existing.status === "suspended"
              ? "Your restaurant is currently suspended. Contact support to discuss next steps."
              : "Your application is awaiting admin review. You can prepare your menu in the meantime."}
        </p>
        <Link className="button" href="/partner/dashboard">
          Open your workspace
          <ArrowRight size={17} />
        </Link>
      </div>
    );
  return (
    <form className="panel partner-form form-stack" onSubmit={submit}>
      <div>
        <h2>Pull up a chair.</h2>
        <p className="muted">Tell us a little about your restaurant.</p>
      </div>
      <label>
        Restaurant name
        <input
          name="name"
          placeholder="Your kitchen’s name"
          minLength={2}
          maxLength={100}
          required
        />
      </label>
      <label>
        Cuisines you serve
        <input
          name="cuisine"
          placeholder="e.g. North Indian, South Indian"
          minLength={2}
          maxLength={100}
          required
        />
      </label>
      <label>
        A little about your food
        <textarea
          name="description"
          placeholder="What makes your kitchen special?"
          rows={3}
          minLength={10}
          maxLength={500}
          required
        />
      </label>
      <label>
        Restaurant address
        <textarea
          name="address"
          placeholder="Full address, including city and PIN code"
          rows={2}
          minLength={8}
          maxLength={300}
          required
        />
      </label>
      <label>
        FSSAI licence number
        <input
          name="license"
          placeholder="14-digit licence number"
          inputMode="numeric"
          pattern="[0-9]{14}"
          maxLength={14}
          required
        />
      </label>
      <div>
        <p className="stop-field-label">Stops you can deliver to</p>
        <div className="stop-checkboxes">
          {stops.map((stop) => (
            <label key={stop.id}>
              <input
                type="checkbox"
                checked={stopIds.includes(stop.id)}
                onChange={(e) =>
                  setStopIds((old) =>
                    e.target.checked
                      ? [...old, stop.id]
                      : old.filter((s) => s !== stop.id),
                  )
                }
              />
              {stop.city}
            </label>
          ))}
        </div>
      </div>
      {user && <p className="small muted">Contact number: {user.phone}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button"
        disabled={busy || (Boolean(user) && !stopIds.length)}
      >
        {busy
          ? "Sending application…"
          : user
            ? "Submit restaurant application"
            : "Log in to apply"}
        <ArrowRight size={17} />
      </button>
      <p className="small muted">
        Applications need admin approval before menus become visible to
        passengers.
      </p>
    </form>
  );
}
export function PartnerPage() {
  return (
    <section className="container page-shell">
      <div className="partner-page-hero">
        <div>
          <div className="eyebrow">GOOD FOOD DESERVES TO GO PLACES</div>
          <h1>
            Your kitchen.
            <br />A whole new
            <br />
            <span>route to grow.</span>
          </h1>
          <p className="lead">
            Turn passing journeys into new customers. Serve freshly made meals
            to travellers at bus stops near your restaurant.
          </p>
          <div className="partner-benefits">
            {[
              {
                icon: Store,
                title: "A new table of customers",
                body: "Reach hungry passengers travelling through your area.",
              },
              {
                icon: ChefHat,
                title: "Your menu, your kitchen",
                body: "Manage your dishes, prices, and availability in one place.",
              },
              {
                icon: MapPin,
                title: "Deliver close to home",
                body: "Choose the supported stops your team can reliably serve.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span>
                  <Icon size={23} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <Link className="text-button" href="/partner/dashboard">
            Already a partner? Open your workspace
            <ArrowRight size={15} />
          </Link>
        </div>
        <Registration />
      </div>
    </section>
  );
}
