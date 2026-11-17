"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, RefreshCw, ShoppingBag } from "lucide-react";
import { useApp } from "./app-provider";
import { request } from "@/lib/client-api";
import type { Order } from "@/lib/types";
import { AuthGate } from "./auth-gate";
import { OrderCard } from "./order-card";
export function OrdersPage() {
  const { user } = useApp();
  const [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await request<{ orders: Order[] }>("orders");
      setOrders(data.orders);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <div className="container page-shell narrow-page">
      <AuthGate>
        <div className="page-heading heading-with-action">
          <div>
            <div className="eyebrow">YOUR JOURNEY, WELL FED</div>
            <h1>My orders</h1>
            <p>From the kitchen to your next stop.</p>
          </div>
          <button
            className="icon-button bordered"
            onClick={refresh}
            aria-label="Refresh orders"
          >
            <RefreshCw size={19} />
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="muted">Fetching your orders…</p>
        ) : orders.length ? (
          <div className="orders-list">
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} onRefresh={refresh} />
            ))}
          </div>
        ) : (
          <div className="empty-state panel">
            <ShoppingBag size={45} />
            <h2>Your first great bite is ahead.</h2>
            <p>You haven’t placed an order yet. Let’s change that.</p>
            <Link href="/menu" className="button">
              Explore the menu
              <ArrowRight size={17} />
            </Link>
          </div>
        )}
      </AuthGate>
    </div>
  );
}
