"use client";
import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useApp } from "./app-provider";
import { Dialog } from "./dialog";
import { money } from "@/lib/types";
import { DELIVERY_FEE, FREE_DELIVERY_MINIMUM } from "@/lib/order-rules";
export function Quantity({ id, quantity }: { id: string; quantity: number }) {
  const { changeQuantity } = useApp();
  return (
    <div className="quantity">
      <button
        aria-label="Decrease quantity"
        onClick={() => changeQuantity(id, -1)}
      >
        <Minus size={14} />
      </button>
      <span>{quantity}</span>
      <button
        aria-label="Increase quantity"
        disabled={quantity >= 20}
        onClick={() => changeQuantity(id, 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
export function BagItems() {
  const { cart, catalog } = useApp();
  return (
    <div className="bag-items">
      {cart.map((item) => {
        const food = catalog.foods.find((f) => f._id === item.foodId);
        return (
          <div className="bag-item" key={item.foodId}>
            {food && <img src={food.image} alt="" width={64} height={64} />}
            <div className="bag-item-info">
              <h3>{food?.name || "Unavailable dish"}</h3>
              <span>
                {food ? money(food.price) : "Please remove this item"}
              </span>
            </div>
            <Quantity id={item.foodId} quantity={item.quantity} />
          </div>
        );
      })}
    </div>
  );
}
export function Bill() {
  const { cart, catalog } = useApp();
  const subtotal = cart.reduce(
    (n, i) =>
      n +
      (catalog.foods.find((f) => f._id === i.foodId)?.price || 0) * i.quantity,
    0,
  );
  const delivery = subtotal >= FREE_DELIVERY_MINIMUM ? 0 : DELIVERY_FEE;
  return (
    <div className="bill">
      <div>
        <span>Item total</span>
        <span>{money(subtotal)}</span>
      </div>
      <div>
        <span>Delivery fee</span>
        <span className={delivery === 0 ? "green" : ""}>
          {delivery === 0 ? "On us" : money(delivery)}
        </span>
      </div>
      <div className="bill-total">
        <span>To pay</span>
        <span>{money(subtotal + delivery)}</span>
      </div>
      <p className="small muted">
        Prices include applicable restaurant taxes. No hidden fees.
      </p>
      {subtotal < FREE_DELIVERY_MINIMUM && (
        <p className="delivery-tip">
          Add {money(FREE_DELIVERY_MINIMUM - subtotal)} more for free delivery.
        </p>
      )}
    </div>
  );
}
export function Bag({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, catalog, clearCart } = useApp();
  const first = catalog.foods.find((f) => f._id === cart[0]?.foodId);
  const restaurant = catalog.restaurants.find(
    (r) => r._id === first?.restaurantId,
  );
  return (
    <Dialog open={open} onClose={onClose} title="Your food bag" drawer>
      {!cart.length ? (
        <div className="empty-state">
          <ShoppingBag size={48} />
          <h3>A little empty, a lot of possibilities.</h3>
          <p>Find your next favourite meal on the menu.</p>
          <button className="button" onClick={onClose}>
            Explore the menu
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <p className="muted">
            Fresh from {restaurant?.name || "your restaurant"}
          </p>
          <BagItems />
          <Bill />
          <Link href="/checkout" className="button full" onClick={onClose}>
            Continue to checkout
            <ArrowRight size={18} />
          </Link>
          <button className="text-button clear-bag" onClick={clearCart}>
            <Trash2 size={15} />
            Empty bag
          </button>
        </>
      )}
    </Dialog>
  );
}
