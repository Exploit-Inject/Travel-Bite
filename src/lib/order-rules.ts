import type { Food, OrderItem, OrderStatus } from "./types";
export const DELIVERY_FEE = 2900;
export const FREE_DELIVERY_MINIMUM = 49900;
export function calculateOrder(
  items: { foodId: string; quantity: number }[],
  foods: Food[],
) {
  if (new Set(items.map((i) => i.foodId)).size !== items.length)
    throw new Error("Duplicate menu items are not allowed.");
  const selected = items.map((i) => {
    const food = foods.find((f) => f._id === i.foodId);
    if (!food || !food.available)
      throw new Error(
        "A selected dish is no longer available. Please refresh your menu.",
      );
    if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 20)
      throw new Error("Invalid quantity.");
    return { food, quantity: i.quantity };
  });
  if (!selected.length) throw new Error("Your bag is empty.");
  if (new Set(selected.map((i) => i.food.restaurantId)).size !== 1)
    throw new Error("Please order from one restaurant at a time.");
  const orderItems: OrderItem[] = selected.map(({ food, quantity }) => ({
    foodId: food._id,
    name: food.name,
    price: food.price,
    image: food.image,
    quantity,
  }));
  const subtotal = orderItems.reduce((n, i) => n + i.price * i.quantity, 0);
  const deliveryFee = subtotal >= FREE_DELIVERY_MINIMUM ? 0 : DELIVERY_FEE;
  return {
    items: orderItems,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    restaurantId: selected[0].food.restaurantId,
    prepMinutes: Math.max(...selected.map((i) => i.food.prepMinutes)),
  };
}
const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["placed"],
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from].includes(to);
}
export function validateArrival(
  arrival: string,
  prepMinutes: number,
  now = Date.now(),
) {
  const time = new Date(arrival).getTime();
  if (!Number.isFinite(time) || time < now + (prepMinutes + 10) * 60000)
    throw new Error(
      `Choose an arrival at least ${prepMinutes + 10} minutes away so we have time to prepare and deliver.`,
    );
  if (time > now + 24 * 60 * 60000)
    throw new Error("Please order within 24 hours of your arrival.");
}
