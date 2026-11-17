"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { request } from "@/lib/client-api";
import type { CartItem, Catalog, Journey, Role } from "@/lib/types";
import { LoginDialog } from "./login-dialog";
import { JourneyDialog } from "./journey-dialog";
import { Bag } from "./bag";

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  phoneVerified: boolean;
  passwordEnabled: boolean;
}
interface AppState {
  catalog: Catalog;
  refreshCatalog: () => Promise<void>;
  user: User | null;
  authLoading: boolean;
  refreshUser: () => Promise<void>;
  cart: CartItem[];
  addItem: (foodId: string) => void;
  changeQuantity: (foodId: string, delta: number) => void;
  clearCart: () => void;
  journey: Journey | null;
  setJourney: (journey: Journey) => void;
  login: () => void;
  editJourney: () => void;
  openBag: () => void;
  closeBag: () => void;
  toast: (text: string, error?: boolean) => void;
  onlinePayments: boolean;
  localSms: boolean;
  favourites: string[];
  toggleFavourite: (id: string) => void;
}
const Context = createContext<AppState | null>(null);
export function useApp() {
  const c = useContext(Context);
  if (!c) throw new Error("AppProvider missing");
  return c;
}
export function AppProvider({
  catalog: initialCatalog,
  children,
  unavailable,
}: {
  catalog: Catalog;
  children: ReactNode;
  unavailable?: boolean;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [catalogUnavailable, setCatalogUnavailable] = useState(unavailable);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [configuration, setConfiguration] = useState({
    onlinePayments: false,
    localSms: false,
  });
  const refreshUser = useCallback(async () => {
    try {
      const data = await request<{ user: User | null }>("me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);
  const refreshCatalog = useCallback(async () => {
    try {
      setCatalog(await request<Catalog>("catalog"));
      setCatalogUnavailable(false);
    } catch {
      /* Keep the last menu during a temporary interruption. Checkout validates it again. */
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) refreshCatalog();
    }, 60000);
    window.addEventListener("focus", refreshCatalog);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshCatalog);
    };
  }, [refreshCatalog]);
  useEffect(() => {
    refreshUser();
    request<typeof configuration>("config")
      .then(setConfiguration)
      .catch(() => {});
    try {
      const stored = JSON.parse(localStorage.getItem("travelbite-v1") || "{}");
      if (Array.isArray(stored.cart))
        setCart(
          stored.cart.filter(
            (i: CartItem) =>
              typeof i.foodId === "string" &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0 &&
              i.quantity <= 20,
          ),
        );
      if (stored.journey?.busNumber && stored.journey?.routeId)
        setJourney(stored.journey);
      if (Array.isArray(stored.favourites))
        setFavourites(
          stored.favourites.filter((id: unknown) => typeof id === "string"),
        );
    } catch {
      /* An invalid local preference never blocks ordering. */
    }
    const query = new URLSearchParams(window.location.search);
    if (query.has("bus") || query.has("seat")) {
      const route =
        catalog.routes.find((r) => r._id === query.get("route")) ||
        catalog.routes[0];
      const stop =
        route?.stops.find((s) => s.id === query.get("stop")) || route?.stops[0];
      if (route && stop)
        setJourney({
          routeId: route._id,
          busNumber: (query.get("bus") || "").slice(0, 24),
          seatNumber: (query.get("seat") || "").slice(0, 12),
          currentLocation: "",
          stopId: stop.id,
          arrivalAt: new Date(Date.now() + stop.minutes * 60000).toISOString(),
        });
      setJourneyOpen(true);
    }
    setReady(true);
  }, [refreshUser, initialCatalog.routes]);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(
          "travelbite-v1",
          JSON.stringify({ cart, journey, favourites }),
        );
      } catch {
        /* Private browsing may disable storage. */
      }
    }
  }, [cart, journey, favourites, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const toast = useCallback(
    (text: string, error?: boolean) => setNotice({ text, error }),
    [],
  );
  const addItem = (foodId: string) => {
    const food = catalog.foods.find((f) => f._id === foodId);
    if (!food?.available) return;
    const first = catalog.foods.find((f) => f._id === cart[0]?.foodId);
    if (first && first.restaurantId !== food.restaurantId) {
      toast(
        "Your bag has food from another restaurant. Empty it first to start a new order.",
        true,
      );
      setBagOpen(true);
      return;
    }
    setCart((old) => {
      const existing = old.find((i) => i.foodId === foodId);
      return existing
        ? old.map((i) =>
            i.foodId === foodId
              ? { ...i, quantity: Math.min(20, i.quantity + 1) }
              : i,
          )
        : [...old, { foodId, quantity: 1 }];
    });
    toast(`${food.name} added to your bag`);
  };
  const changeQuantity = (foodId: string, delta: number) =>
    setCart((old) =>
      old
        .map((i) =>
          i.foodId === foodId
            ? { ...i, quantity: Math.min(20, i.quantity + delta) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  return (
    <Context.Provider
      value={{
        catalog,
        refreshCatalog,
        cart,
        addItem,
        changeQuantity,
        clearCart: () => setCart([]),
        journey,
        setJourney,
        user,
        authLoading,
        refreshUser,
        login: () => setLoginOpen(true),
        editJourney: () => setJourneyOpen(true),
        openBag: () => setBagOpen(true),
        closeBag: () => setBagOpen(false),
        toast,
        ...configuration,
        favourites,
        toggleFavourite: (id) =>
          setFavourites((old) =>
            old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
          ),
      }}
    >
      {catalogUnavailable && (
        <div className="system-notice" role="status">
          We’re having trouble loading the menu. Please try again shortly.
        </div>
      )}
      {children}
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <JourneyDialog open={journeyOpen} onClose={() => setJourneyOpen(false)} />
      <Bag open={bagOpen} onClose={() => setBagOpen(false)} />
      {notice && (
        <div
          className={`toast ${notice.error ? "toast-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? (
            <AlertCircle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          {notice.text}
        </div>
      )}
    </Context.Provider>
  );
}
