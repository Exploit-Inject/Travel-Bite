"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BusFront,
  Check,
  ChefHat,
  ClipboardList,
  Download,
  IndianRupee,
  LayoutDashboard,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  Search,
  Settings2,
  ShoppingBag,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import { AuthGate } from "./auth-gate";
import { useApp } from "./app-provider";
import { OrderCard } from "./order-card";
import { request } from "@/lib/client-api";
import {
  ORDER_LABELS,
  money,
  type BusRoute,
  type Order,
  type Restaurant,
} from "@/lib/types";

interface Customer {
  _id: string;
  name: string;
  phoneNumber: string;
  role?: string;
  createdAt: string;
}
interface AdminData {
  orders: Order[];
  restaurants: Restaurant[];
  customers: Customer[];
  routes: BusRoute[];
  stats: { total: number; revenue: number; active: number };
  customerCount: number;
}
function RouteManager({
  routes,
  refresh,
}: {
  routes: BusRoute[];
  refresh: () => void;
}) {
  const { toast } = useApp();
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState("");
  const [stops, setStops] = useState([
    { id: "", name: "", city: "", minutes: 60 },
  ]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("admin/routes", "POST", { name, active: true, stops });
      setAdding(false);
      setName("");
      setStops([{ id: "", name: "", city: "", minutes: 60 }]);
      refresh();
      toast("Route added. Partners can now select its stops.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="management-toolbar">
        <span className="small muted">{routes.length} routes configured</span>
        <button
          className="button button-small push-right"
          onClick={() => setAdding(!adding)}
        >
          <Plus size={16} />
          Add route
        </button>
      </div>
      {adding && (
        <form className="panel route-form form-stack" onSubmit={submit}>
          <h2>A new road to good food</h2>
          <label>
            Route name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Delhi → Chandigarh"
              minLength={3}
              maxLength={100}
              required
            />
          </label>
          <div>
            {stops.map((s, i) => (
              <div className="stop-builder" key={i}>
                {(
                  [
                    {
                      key: "id",
                      label: "Stop ID",
                      placeholder: "e.g. panipat",
                      type: "text",
                    },
                    {
                      key: "name",
                      label: "Stop name",
                      placeholder: "e.g. Panipat Bus Stand",
                      type: "text",
                    },
                    {
                      key: "city",
                      label: "City",
                      placeholder: "e.g. Panipat",
                      type: "text",
                    },
                    {
                      key: "minutes",
                      label: "Suggested minutes from departure",
                      placeholder: "60",
                      type: "number",
                    },
                  ] as const
                ).map((field) => (
                  <label key={field.key}>
                    {field.label}
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={s[field.key]}
                      min={field.type === "number" ? 20 : undefined}
                      max={field.type === "number" ? 1440 : undefined}
                      pattern={field.key === "id" ? "[a-z0-9-]+" : undefined}
                      required
                      onChange={(e) =>
                        setStops((old) =>
                          old.map((stop, index) =>
                            index === i
                              ? {
                                  ...stop,
                                  [field.key]:
                                    field.type === "number"
                                      ? Number(e.target.value)
                                      : e.target.value,
                                }
                              : stop,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                {stops.length > 1 && (
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() =>
                      setStops((old) => old.filter((_, j) => j !== i))
                    }
                  >
                    Remove stop
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setStops((old) => [
                ...old,
                { id: "", name: "", city: "", minutes: 120 },
              ])
            }
          >
            <Plus size={15} />
            Add another stop
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save route"}
            <ArrowRight size={16} />
          </button>
        </form>
      )}
      {routes.map((route) => (
        <article className="route-card" key={route._id}>
          <header>
            <h2>{route.name}</h2>
            <span
              className={`badge ${route.active ? "badge-green" : "badge-gray"}`}
            >
              {route.active ? "Active" : "Paused"}
            </span>
          </header>
          <div className="route-stops">
            {route.stops.map((s, index) => (
              <span key={s.id}>
                {index + 1}. {s.name}
                <small>
                  {s.city} · ~{s.minutes} min · {s.id}
                </small>
              </span>
            ))}
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await request(`admin/routes/${route._id}`, "PATCH", {
                  active: !route.active,
                });
                refresh();
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {route.active ? "Pause new orders on this route" : "Activate route"}
          </button>
        </article>
      ))}
    </>
  );
}
function QrGenerator({ routes }: { routes: BusRoute[] }) {
  const [routeId, setRouteId] = useState(
      routes.find((r) => r.active)?._id || "",
    ),
    [bus, setBus] = useState(""),
    [seat, setSeat] = useState("");
  const route = routes.find((r) => r._id === routeId);
  const [stop, setStop] = useState(route?.stops[0]?.id || ""),
    [qr, setQr] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (bus.trim().length < 4 || !seat.trim() || !routeId) {
      setQr("");
      setUrl("");
      return;
    }
    const query = new URLSearchParams({
      route: routeId,
      bus: bus.trim(),
      seat: seat.trim(),
      stop,
    });
    const url = `${window.location.origin}/menu?${query}`;
    setUrl(url);
    import("qrcode")
      .then((module) =>
        module.default.toDataURL(url, {
          width: 600,
          margin: 3,
          color: { dark: "#25352d", light: "#ffffff" },
          errorCorrectionLevel: "M",
        }),
      )
      .then((image) => {
        if (active) {
          setQr(image);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Couldn't generate this QR code.");
      });
    return () => {
      active = false;
    };
  }, [bus, seat, routeId, stop]);
  return (
    <div className="qr-layout">
      <div className="panel form-stack">
        <h2>A delicious journey starts with a scan.</h2>
        <p className="small muted">
          Create a QR for each passenger seat. Scanning opens the menu with the
          bus, seat and route already filled in.
        </p>
        <label>
          Bus route
          <select
            value={routeId}
            onChange={(e) => {
              setRouteId(e.target.value);
              setStop(
                routes.find((r) => r._id === e.target.value)?.stops[0]?.id ||
                  "",
              );
            }}
          >
            {routes
              .filter((r) => r.active)
              .map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Bus number
          <input
            placeholder="DL 01 AB 1234"
            value={bus}
            onChange={(e) => setBus(e.target.value.toUpperCase())}
            minLength={4}
            maxLength={24}
          />
        </label>
        <label>
          Seat number
          <input
            placeholder="12A"
            value={seat}
            onChange={(e) => setSeat(e.target.value.toUpperCase())}
            maxLength={12}
          />
        </label>
        <label>
          Suggested delivery stop
          <select value={stop} onChange={(e) => setStop(e.target.value)}>
            {route?.stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="info-box">
          Generate final codes on your production domain. A localhost QR will
          only work on the device running the website.
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="qr-preview">
        <span className="eyebrow">TRAVEL BITE · SCAN TO ORDER</span>
        <h2>
          Hungry? You’re in
          <br />
          the right seat.
        </h2>
        {qr ? (
          <img
            src={qr}
            alt={`Menu QR for bus ${bus}, seat ${seat}`}
            width={210}
            height={210}
          />
        ) : (
          <div className="empty-state" style={{ minHeight: 210, padding: 30 }}>
            <QrCode size={80} />
            <p>Enter a bus and seat to generate your QR.</p>
          </div>
        )}
        <p>
          {bus || "Your bus"} · Seat {seat || "—"}
        </p>
        {qr && (
          <a
            className="button button-small"
            href={qr}
            download={`travel-bite-${bus.replace(/\s+/g, "-")}-${seat}.png`}
          >
            <Download size={16} />
            Download seat QR
          </a>
        )}
        {url && (
          <a className="qr-url" href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        )}
      </div>
    </div>
  );
}
export function AdminDashboard() {
  const { user, toast } = useApp();
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("overview");
  const [status, setStatus] = useState("all"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      setData(await request<AdminData>("admin"));
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
  const filtered = useMemo(
    () =>
      data?.orders.filter(
        (o) =>
          (status === "all" || o.status === status) &&
          `${o._id} ${o.customerName} ${o.customerPhone} ${o.journey.busNumber} ${o.stopName} ${o.restaurantName}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ) || [],
    [data, status, search],
  );
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const date = d.toLocaleDateString("en-CA");
    return {
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      count:
        data?.orders.filter(
          (o) =>
            new Date(o.createdAt).toLocaleDateString("en-CA") === date &&
            o.status !== "cancelled",
        ).length || 0,
    };
  });
  const tabs = [
    { id: "overview", name: "Overview", icon: LayoutDashboard },
    { id: "orders", name: "Orders", icon: ClipboardList },
    { id: "deliveries", name: "Deliveries", icon: Truck },
    { id: "restaurants", name: "Restaurants", icon: Store },
    { id: "customers", name: "Customers", icon: Users },
    { id: "routes", name: "Routes & stops", icon: Route },
    { id: "qr", name: "Seat QR codes", icon: QrCode },
  ];
  async function restaurantStatus(
    id: string,
    status: "approved" | "suspended",
  ) {
    setBusy(true);
    try {
      await request(`admin/restaurants/${id}`, "PATCH", { status });
      refresh();
      toast(
        status === "approved"
          ? "Restaurant approved. Its available menu is now live."
          : "Restaurant suspended. Its menu is hidden from passengers.",
      );
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container">
      <AuthGate roles={["admin"]}>
        <div className="workspace">
          <aside className="workspace-nav">
            <div className="workspace-brand">
              <Settings2 size={19} />
              TRAVEL BITE ADMIN
            </div>
            {tabs.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                className={tab === id ? "selected" : ""}
                onClick={() => {
                  setTab(id);
                  setSearch("");
                  setStatus("all");
                }}
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
                <div className="eyebrow">KEEPING GOOD FOOD ON THE MOVE</div>
                <h1>{tabs.find((t) => t.id === tab)?.name}</h1>
                <p>
                  {tab === "overview"
                    ? "Your kitchens, customers and journeys at a glance."
                    : "Manage the details that make every delivery count."}
                </p>
              </div>
              <button
                className="icon-button bordered"
                onClick={refresh}
                aria-label="Refresh dashboard"
              >
                <RefreshCw size={17} />
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {!data ? (
              <p className="muted">Loading your dashboard…</p>
            ) : (
              <>
                {tab === "overview" && (
                  <>
                    <div className="stat-grid">
                      {[
                        {
                          name: "Total orders",
                          value: data.stats.total,
                          icon: ShoppingBag,
                          note: "All time",
                        },
                        {
                          name: "Collected value",
                          value: money(data.stats.revenue),
                          icon: IndianRupee,
                          note: "Paid & cash-collected orders",
                        },
                        {
                          name: "Active deliveries",
                          value: data.stats.active,
                          icon: Truck,
                          note: "Placed through out for delivery",
                        },
                        {
                          name: "Customers",
                          value: data.customerCount,
                          icon: Users,
                          note: "Registered accounts",
                        },
                      ].map(({ name, value, icon: Icon, note }, index) => (
                        <div
                          className={`stat-card ${index === 0 ? "stat-highlight" : ""}`}
                          key={name}
                        >
                          <div className="stat-card-top">
                            {name}
                            <Icon size={17} />
                          </div>
                          <strong>{value}</strong>
                          <small>{note}</small>
                        </div>
                      ))}
                    </div>
                    <div className="dashboard-grid">
                      <div className="panel">
                        <h2>Orders over the past week</h2>
                        <p className="small muted">
                          Based on the latest 200 orders
                        </p>
                        <div className="weekly-chart">
                          {weekly.map((d, i) => (
                            <div className="chart-day" key={i}>
                              <div
                                className="chart-bar"
                                style={{
                                  height: `${Math.max(3, (d.count / Math.max(1, ...weekly.map((x) => x.count))) * 100)}%`,
                                }}
                                aria-label={`${d.label}: ${d.count} orders`}
                              >
                                <span>{d.count}</span>
                              </div>
                              <small>{d.label}</small>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="panel">
                        <h2>Kitchen activity</h2>
                        <div className="dashboard-list">
                          <div>
                            <span>
                              Approved restaurants
                              <small>Ready to serve passengers</small>
                            </span>
                            <span className="badge badge-green">
                              {
                                data.restaurants.filter(
                                  (r) => r.status === "approved",
                                ).length
                              }
                            </span>
                          </div>
                          <div>
                            <span>
                              Awaiting review
                              <small>New restaurant applications</small>
                            </span>
                            <span className="badge badge-orange">
                              {
                                data.restaurants.filter(
                                  (r) => r.status === "pending",
                                ).length
                              }
                            </span>
                          </div>
                          <div>
                            <span>
                              Refunds to reconcile
                              <small>Pending without provider reference</small>
                            </span>
                            <span className="badge badge-gray">
                              {
                                data.orders.filter(
                                  (o) =>
                                    o.paymentStatus === "refund_pending" &&
                                    !o.refundId,
                                ).length
                              }
                            </span>
                          </div>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setTab("restaurants")}
                        >
                          Manage restaurants
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="dashboard-section-heading">
                      <h2>Latest orders</h2>
                      <button onClick={() => setTab("orders")}>
                        View all
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    <div className="orders-list">
                      {data.orders.length ? (
                        data.orders
                          .slice(0, 4)
                          .map((o) => (
                            <OrderCard
                              key={o._id}
                              order={o}
                              manage="admin"
                              onRefresh={refresh}
                            />
                          ))
                      ) : (
                        <div className="panel empty-state">
                          <ShoppingBag size={36} />
                          <h3>Ready for the first order.</h3>
                          <p>
                            Passenger orders will appear here as they arrive.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {(tab === "orders" || tab === "deliveries") && (
                  <>
                    <div className="management-toolbar">
                      <div className="search-field">
                        <Search size={17} />
                        <input
                          placeholder="Search order, bus, customer or stop"
                          aria-label="Search orders"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        aria-label="Filter order status"
                      >
                        <option value="all">All statuses</option>
                        {Object.entries(ORDER_LABELS).map(([s, label]) => (
                          <option value={s} key={s}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="small muted" style={{ marginBottom: 17 }}>
                      Latest 200 orders.{" "}
                      {tab === "deliveries" &&
                        "Showing orders in preparation or on the way."}
                    </p>
                    <div className="orders-list">
                      {filtered
                        .filter(
                          (o) =>
                            tab !== "deliveries" ||
                            ["preparing", "out_for_delivery"].includes(
                              o.status,
                            ),
                        )
                        .map((o) => (
                          <OrderCard
                            key={o._id}
                            order={o}
                            manage="admin"
                            onRefresh={refresh}
                          />
                        ))}
                      {!filtered.filter(
                        (o) =>
                          tab !== "deliveries" ||
                          ["preparing", "out_for_delivery"].includes(o.status),
                      ).length && (
                        <div className="empty-state panel">
                          <Truck size={36} />
                          <h3>No orders to show.</h3>
                          <p>
                            Try changing the filters, or check again after the
                            next order.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {tab === "restaurants" && (
                  <div className="management-grid">
                    {data.restaurants.map((r) => (
                      <article
                        className="restaurant-management-card"
                        key={r._id}
                      >
                        <header>
                          <img src={r.image} alt="" width={45} height={45} />
                          <div>
                            <h2>{r.name}</h2>
                            <p>{r.cuisine}</p>
                          </div>
                          <span
                            className={`badge ${r.status === "approved" ? "badge-green" : r.status === "suspended" ? "badge-red" : "badge-orange"}`}
                          >
                            {r.status}
                          </span>
                        </header>
                        <p>{r.description}</p>
                        <p>
                          <strong>Address:</strong> {r.address}
                        </p>
                        <p>
                          <strong>Phone:</strong>{" "}
                          <a href={`tel:${r.phone}`}>{r.phone}</a>
                        </p>
                        <p>
                          <strong>FSSAI:</strong> {r.license}
                        </p>
                        <p>
                          <strong>Stops:</strong>{" "}
                          {r.stopIds
                            .map(
                              (id) =>
                                data.routes
                                  .flatMap((route) => route.stops)
                                  .find((s) => s.id === id)?.city || id,
                            )
                            .join(", ")}
                        </p>
                        {r.license === "SAMPLE" && (
                          <p className="info-box">
                            Sample restaurant. Replace with a verified partner
                            before launch.
                          </p>
                        )}
                        <div className="management-card-actions">
                          {r.status !== "approved" && (
                            <button
                              className="button button-small"
                              disabled={busy || r.license === "SAMPLE"}
                              onClick={() =>
                                restaurantStatus(r._id, "approved")
                              }
                            >
                              <Check size={14} />
                              Approve restaurant
                            </button>
                          )}
                          {r.status !== "suspended" && (
                            <button
                              className="text-button danger"
                              disabled={busy}
                              onClick={() =>
                                restaurantStatus(r._id, "suspended")
                              }
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {tab === "customers" && (
                  <>
                    <p className="small muted" style={{ marginBottom: 16 }}>
                      {data.customerCount} registered accounts · Showing latest
                      100
                    </p>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>CUSTOMER</th>
                            <th>PHONE NUMBER</th>
                            <th>ROLE</th>
                            <th>JOINED</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.customers.map((c) => (
                            <tr key={c._id}>
                              <td>
                                <strong>{c.name}</strong>
                              </td>
                              <td>
                                <a href={`tel:${c.phoneNumber}`}>
                                  {c.phoneNumber}
                                </a>
                              </td>
                              <td>
                                <span className="badge badge-gray">
                                  {c.role || "passenger"}
                                </span>
                              </td>
                              <td>
                                {new Date(c.createdAt).toLocaleDateString(
                                  "en-IN",
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {tab === "routes" && (
                  <RouteManager routes={data.routes} refresh={refresh} />
                )}
                {tab === "qr" && <QrGenerator routes={data.routes} />}
              </>
            )}
          </div>
        </div>
      </AuthGate>
    </div>
  );
}
