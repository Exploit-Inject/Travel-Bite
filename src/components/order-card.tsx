"use client";
import { useState } from "react";
import {
  ArrowRight,
  BusFront,
  Clock3,
  MapPin,
  Phone,
  UtensilsCrossed,
} from "lucide-react";
import { ORDER_LABELS, money, type Order, type OrderStatus } from "@/lib/types";
import { request } from "@/lib/client-api";
import { payForOrder, type PaymentSession } from "@/lib/checkout";
import { useApp } from "./app-provider";
export function OrderCard({
  order,
  manage,
  onRefresh,
}: {
  order: Order;
  manage?: "admin" | "restaurant";
  onRefresh: () => void;
}) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [agent, setAgent] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const next: Partial<Record<OrderStatus, OrderStatus>> = {
    placed: "accepted",
    accepted: "preparing",
    preparing: "out_for_delivery",
    out_for_delivery: "delivered",
  };
  const nextLabel: Partial<Record<OrderStatus, string>> = {
    placed: "Accept order",
    accepted: "Start preparing",
    preparing: "Dispatch delivery",
    out_for_delivery: "Mark delivered & confirm payment",
  };
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const timeline: OrderStatus[] = [
    "placed",
    "accepted",
    "preparing",
    "out_for_delivery",
    "delivered",
  ];
  const current = timeline.indexOf(order.status);
  return (
    <article
      className={`order-card ${order.status === "cancelled" ? "order-cancelled" : ""}`}
      id={order._id}
    >
      <div className="order-card-heading">
        <div>
          <span className="small muted">
            {order._id} ·{" "}
            {new Date(order.createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <h2>{order.restaurantName}</h2>
        </div>
        <span
          className={`badge ${order.status === "delivered" ? "badge-green" : order.status === "cancelled" ? "badge-red" : "badge-orange"}`}
        >
          {ORDER_LABELS[order.status]}
        </span>
      </div>
      <div className="order-items-list">
        {order.items.map((item) => (
          <div key={item.foodId}>
            <img src={item.image} alt="" width={44} height={44} />
            <span>
              {item.quantity} × {item.name}
            </span>
            <strong>{money(item.price * item.quantity)}</strong>
          </div>
        ))}
      </div>
      {current >= 0 && (
        <div className="order-timeline" aria-label="Order progress">
          {timeline.map((status, index) => (
            <div key={status} className={index <= current ? "reached" : ""}>
              <span />
              <small>{ORDER_LABELS[status]}</small>
            </div>
          ))}
        </div>
      )}
      <div className="order-details">
        <p>
          <MapPin size={16} />
          <span>
            {order.stopName}
            <small>
              Expected{" "}
              {new Date(order.journey.arrivalAt).toLocaleString("en-IN", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </small>
          </span>
        </p>
        <p>
          <BusFront size={16} />
          <span>
            {order.journey.busNumber} · Seat {order.journey.seatNumber}
            <small>Near {order.journey.currentLocation}</small>
          </span>
        </p>
        {manage && (
          <p>
            <Phone size={16} />
            <span>
              {order.customerName}
              <small>
                <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>
              </small>
            </span>
          </p>
        )}
        {order.deliveryAgent && (
          <p>
            <Phone size={16} />
            <span>
              {order.deliveryAgent}
              <small>
                <a href={`tel:${order.deliveryPhone}`}>{order.deliveryPhone}</a>
              </small>
            </span>
          </p>
        )}
      </div>
      {order.notes && (
        <p className="order-note">
          <UtensilsCrossed size={14} />
          Kitchen note: {order.notes}
        </p>
      )}
      <div className="order-total">
        <span>
          {order.paymentMethod === "cod" ? "Cash on delivery" : "Razorpay"}
          <small>
            {order.paymentStatus.replaceAll("_", " ")}
            {order.refundId ? ` · ${order.refundId}` : ""}
          </small>
        </span>
        <strong>{money(order.total)}</strong>
      </div>
      {manage === "admin" && order.status === "preparing" && (
        <div className="form-row dispatch-fields">
          <label>
            Delivery person
            <input
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              placeholder="Full name"
              maxLength={80}
            />
          </label>
          <label>
            Delivery phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              type="tel"
            />
          </label>
        </div>
      )}
      <div className="order-actions">
        {manage &&
          next[order.status] &&
          !(
            manage === "restaurant" &&
            ["preparing", "out_for_delivery"].includes(order.status)
          ) && (
            <button
              className="button button-small"
              disabled={busy}
              onClick={() =>
                action(() =>
                  request(`manage/orders/${order._id}`, "PATCH", {
                    status: next[order.status],
                    ...(order.status === "preparing"
                      ? { deliveryAgent: agent, deliveryPhone: phone }
                      : {}),
                  }),
                )
              }
            >
              {busy ? "Updating…" : nextLabel[order.status]}
              <ArrowRight size={15} />
            </button>
          )}
        {!manage && order.status === "pending_payment" && (
          <button
            className="button button-small"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const session = await request<PaymentSession>(
                  `orders/${order._id}/payment`,
                  "POST",
                  {},
                );
                await payForOrder(session);
                toast("Payment confirmed.");
              })
            }
          >
            {busy ? "Opening checkout…" : "Complete payment"}
            <ArrowRight size={16} />
          </button>
        )}
        {!confirmCancel &&
          ((manage && ["placed", "accepted"].includes(order.status)) ||
            (!manage &&
              order.status === "placed" &&
              order.paymentMethod === "cod")) && (
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              {manage === "admin" && order.paymentStatus === "paid"
                ? "Cancel & refund"
                : "Cancel order"}
            </button>
          )}
        {confirmCancel && (
          <div className="cancel-confirm">
            <span>
              Cancel this order
              {order.paymentStatus === "paid" ? " and issue a full refund" : ""}
              ?
            </span>
            <button
              className="button button-small button-danger"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  if (manage === "admin" && order.paymentStatus === "paid")
                    await request(
                      `admin/orders/${order._id}/refund`,
                      "POST",
                      {},
                    );
                  else if (manage)
                    await request(`manage/orders/${order._id}`, "PATCH", {
                      status: "cancelled",
                    });
                  else await request(`orders/${order._id}/cancel`, "POST", {});
                  setConfirmCancel(false);
                })
              }
            >
              Yes, cancel
            </button>
            <button
              className="text-button"
              onClick={() => setConfirmCancel(false)}
            >
              Keep order
            </button>
          </div>
        )}
      </div>
      {order.paymentStatus === "refund_pending" && (
        <p className="info-box">
          Refund processing.{" "}
          {manage === "admin" && !order.refundId
            ? "Check the payment in Razorpay and reconcile the refund before taking further action."
            : "Your refund status will update after confirmation from the payment provider."}
        </p>
      )}
    </article>
  );
}
