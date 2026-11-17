"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  ClipboardList,
  IndianRupee,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { useApp } from "./app-provider";
import { AuthGate } from "./auth-gate";
import { Dialog } from "./dialog";
import { OrderCard } from "./order-card";
import { request } from "@/lib/client-api";
import { money, type Food, type Order, type Restaurant } from "@/lib/types";

interface PartnerData {
  restaurant: Restaurant | null;
  foods: Food[];
  orders: Order[];
}
const blankFood: Omit<Food, "_id" | "restaurantId"> = {
  name: "",
  description: "",
  price: 14900,
  category: "Meals",
  image: "/images/thali.jpg",
  veg: true,
  available: true,
  prepMinutes: 20,
  popular: false,
};
function MenuEditor({
  food,
  close,
  saved,
}: {
  food: Food | null;
  close: () => void;
  saved: () => void;
}) {
  const [form, setForm] = useState(food || blankFood),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = <K extends keyof typeof blankFood>(
    key: K,
    value: (typeof blankFood)[K],
  ) => setForm((old) => ({ ...old, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const {
        name,
        description,
        price,
        category,
        image,
        veg,
        available,
        prepMinutes,
        popular,
      } = form;
      await request(
        food ? `partner/menu/${food._id}` : "partner/menu",
        food ? "PATCH" : "POST",
        {
          name,
          description,
          price,
          category,
          image,
          veg,
          available,
          prepMinutes,
          popular,
        },
      );
      saved();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack menu-editor">
      <label>
        Dish name
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          minLength={2}
          maxLength={100}
          required
        />
      </label>
      <label>
        Description
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          minLength={5}
          maxLength={300}
          rows={3}
          required
        />
      </label>
      <div className="form-row">
        <label>
          Price in rupees
          <input
            type="number"
            min="1"
            max="1000"
            step="0.01"
            value={form.price / 100}
            onChange={(e) =>
              update("price", Math.round(Number(e.target.value) * 100))
            }
            required
          />
        </label>
        <label>
          Preparation (minutes)
          <input
            type="number"
            min="5"
            max="120"
            value={form.prepMinutes}
            onChange={(e) => update("prepMinutes", Number(e.target.value))}
            required
          />
        </label>
      </div>
      <label>
        Category
        <select
          value={form.category}
          onChange={(e) =>
            update("category", e.target.value as Food["category"])
          }
        >
          {["Meals", "Biryani", "Snacks", "South Indian", "Beverages"].map(
            (c) => (
              <option key={c}>{c}</option>
            ),
          )}
        </select>
      </label>
      <label>
        Image URL
        <input
          value={form.image}
          onChange={(e) => update("image", e.target.value)}
          placeholder="https://… or /images/thali.jpg"
          required
        />
      </label>
      <p className="small muted">
        Use a photo you own or have permission to use. Paste a public HTTPS
        image URL.
      </p>
      <div className="form-row">
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.veg}
            onChange={(e) => update("veg", e.target.checked)}
          />
          Vegetarian
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => update("available", e.target.checked)}
          />
          Available to order
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : food ? "Save dish" : "Add dish"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
export function PartnerDashboard() {
  const { user, toast } = useApp();
  const [data, setData] = useState<PartnerData | null>(null),
    [error, setError] = useState("");
  const [tab, setTab] = useState("overview"),
    [editorOpen, setEditorOpen] = useState(false),
    [editing, setEditing] = useState<Food | null>(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setData(await request<PartnerData>("partner"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [user]);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 20000);
    return () => clearInterval(timer);
  }, [refresh]);
  const active =
    data?.orders.filter(
      (o) => !["delivered", "cancelled"].includes(o.status),
    ) || [];
  const revenue =
    data?.orders
      .filter((o) => ["paid", "cash_collected"].includes(o.paymentStatus))
      .reduce((n, o) => n + o.total, 0) || 0;
  return (
    <div className="container">
      <AuthGate>
        {!data ? (
          <div className="page-shell">
            <p className={error ? "form-error" : "muted"}>
              {error || "Opening your kitchen…"}
            </p>
          </div>
        ) : !data.restaurant ? (
          <div className="empty-state">
            <ChefHat size={48} />
            <h1>Your kitchen’s next chapter starts here.</h1>
            <p>
              Register your restaurant to add a menu and reach bus passengers.
            </p>
            <Link className="button" href="/partner">
              Register your restaurant
              <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <div className="workspace">
            <aside className="workspace-nav">
              <div className="workspace-brand">
                <ChefHat size={19} />
                PARTNER WORKSPACE
              </div>
              {[
                { id: "overview", name: "Overview", icon: LayoutDashboard },
                { id: "orders", name: "Incoming orders", icon: ClipboardList },
                { id: "menu", name: "My menu", icon: UtensilsCrossed },
                { id: "restaurant", name: "My restaurant", icon: Store },
              ].map(({ id, name, icon: Icon }) => (
                <button
                  className={tab === id ? "selected" : ""}
                  key={id}
                  onClick={() => setTab(id)}
                >
                  <Icon size={17} />
                  {name}
                </button>
              ))}
              <Link href="/account">
                <ArrowLeft size={16} />
                My account
              </Link>
            </aside>
            <div className="workspace-main">
              <div className="page-heading heading-with-action">
                <div>
                  <div className="eyebrow">
                    A GOOD DAY STARTS IN THE KITCHEN
                  </div>
                  <h1>
                    {tab === "overview"
                      ? data.restaurant.name
                      : tab === "orders"
                        ? "Incoming orders"
                        : tab === "menu"
                          ? "Your menu"
                          : "Your restaurant"}
                  </h1>
                  <p>Fresh food. Happy travellers. Let’s get cooking.</p>
                </div>
                <button
                  className="icon-button bordered"
                  onClick={refresh}
                  aria-label="Refresh workspace"
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              {error && <p className="form-error">{error}</p>}
              {data.restaurant.status !== "approved" && (
                <div className="info-box partner-pending">
                  {data.restaurant.status === "pending"
                    ? "Your application is awaiting approval. Add your dishes now; they will go live after admin review."
                    : "Your restaurant is suspended. Contact support before accepting further orders."}
                </div>
              )}
              {tab === "overview" && (
                <>
                  <div
                    className="stat-grid"
                    style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
                  >
                    {[
                      {
                        name: "Active orders",
                        value: active.length,
                        icon: ShoppingBag,
                      },
                      {
                        name: "Dishes on menu",
                        value: data.foods.length,
                        icon: UtensilsCrossed,
                      },
                      {
                        name: "Collected order value",
                        value: money(revenue),
                        icon: IndianRupee,
                      },
                    ].map(({ name, value, icon: Icon }) => (
                      <div className="stat-card" key={name}>
                        <div className="stat-card-top">
                          {name}
                          <Icon size={17} />
                        </div>
                        <strong>{value}</strong>
                        <small>
                          {name === "Collected order value"
                            ? "From latest 100 orders; before settlement"
                            : "Your kitchen at a glance"}
                        </small>
                      </div>
                    ))}
                  </div>
                  <div className="dashboard-section-heading">
                    <h2>Orders to get cooking</h2>
                    <button onClick={() => setTab("orders")}>
                      View all
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="orders-list">
                    {active.length ? (
                      active
                        .slice(0, 5)
                        .map((o) => (
                          <OrderCard
                            key={o._id}
                            order={o}
                            manage="restaurant"
                            onRefresh={refresh}
                          />
                        ))
                    ) : (
                      <div className="panel empty-state">
                        <ChefHat size={35} />
                        <h3>Your kitchen is all caught up.</h3>
                        <p>New orders will appear here.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              {tab === "orders" && (
                <div className="orders-list">
                  {data.orders.length ? (
                    data.orders.map((o) => (
                      <OrderCard
                        key={o._id}
                        order={o}
                        manage="restaurant"
                        onRefresh={refresh}
                      />
                    ))
                  ) : (
                    <div className="empty-state panel">
                      <ShoppingBag size={36} />
                      <h3>No orders yet.</h3>
                      <p>Keep your menu ready for the next bus.</p>
                    </div>
                  )}
                </div>
              )}
              {tab === "menu" && (
                <>
                  <div className="management-toolbar">
                    <p className="small muted">
                      {data.foods.length} dishes · Prices in INR
                    </p>
                    <button
                      className="button button-small push-right"
                      onClick={() => {
                        setEditing(null);
                        setEditorOpen(true);
                      }}
                      disabled={data.restaurant.status === "suspended"}
                    >
                      <Plus size={16} />
                      Add a dish
                    </button>
                  </div>
                  {data.foods.length ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>DISH</th>
                            <th>PRICE</th>
                            <th>AVAILABILITY</th>
                            <th>EDIT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.foods.map((f) => (
                            <tr key={f._id}>
                              <td>
                                <div className="table-food">
                                  <img
                                    src={f.image}
                                    alt=""
                                    width={42}
                                    height={38}
                                  />
                                  <strong>{f.name}</strong>
                                </div>
                              </td>
                              <td>{money(f.price)}</td>
                              <td>
                                <button
                                  disabled={
                                    data.restaurant?.status === "suspended"
                                  }
                                  className={`badge ${f.available ? "badge-green" : "badge-gray"}`}
                                  aria-label={`${f.available ? "Mark unavailable" : "Mark available"}: ${f.name}`}
                                  onClick={async () => {
                                    try {
                                      await request(
                                        `partner/menu/${f._id}`,
                                        "PATCH",
                                        { available: !f.available },
                                      );
                                      refresh();
                                    } catch (e) {
                                      toast((e as Error).message, true);
                                    }
                                  }}
                                >
                                  {f.available ? "Available" : "Sold out"}
                                </button>
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${f.name}`}
                                  disabled={
                                    data.restaurant?.status === "suspended"
                                  }
                                  onClick={() => {
                                    setEditing(f);
                                    setEditorOpen(true);
                                  }}
                                >
                                  <Pencil size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state panel">
                      <UtensilsCrossed size={36} />
                      <h3>Good food starts with a menu.</h3>
                      <p>Add your first dish using the button above.</p>
                    </div>
                  )}
                </>
              )}
              {tab === "restaurant" && (
                <div className="panel legal-copy">
                  <h2>{data.restaurant.name}</h2>
                  <p>{data.restaurant.description}</p>
                  <h2>Restaurant details</h2>
                  <p>
                    {data.restaurant.address}
                    <br />
                    Contact: {data.restaurant.phone}
                    <br />
                    FSSAI: {data.restaurant.license}
                    <br />
                    Cuisines: {data.restaurant.cuisine}
                    <br />
                    Status: {data.restaurant.status}
                  </p>
                  <h2>Delivery stops</h2>
                  <p>{data.restaurant.stopIds.join(", ")}</p>
                  <p>
                    Contact the Travel Bite administrator to update verified
                    restaurant details or delivery coverage.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </AuthGate>
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? "Edit your dish" : "Something delicious to add?"}
      >
        <MenuEditor
          food={editing}
          close={() => setEditorOpen(false)}
          saved={refresh}
        />
      </Dialog>
    </div>
  );
}
