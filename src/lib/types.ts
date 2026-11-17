export type Role = "passenger" | "restaurant" | "admin";
export type Category =
  "All" | "Meals" | "Biryani" | "Snacks" | "South Indian" | "Beverages";
export type OrderStatus =
  | "pending_payment"
  | "placed"
  | "accepted"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type PaymentStatus =
  | "pending"
  | "paid"
  | "cash_due"
  | "cash_collected"
  | "refund_pending"
  | "refunded";
export interface Stop {
  id: string;
  name: string;
  city: string;
  minutes: number;
}
export interface BusRoute {
  _id: string;
  name: string;
  stops: Stop[];
  active: boolean;
}
export interface Restaurant {
  _id: string;
  name: string;
  description: string;
  cuisine: string;
  image: string;
  stopIds: string[];
  ownerId?: string;
  status: "pending" | "approved" | "suspended";
  phone: string;
  address: string;
  license: string;
  createdAt: string;
}
export interface Food {
  _id: string;
  restaurantId: string;
  name: string;
  description: string;
  category: Exclude<Category, "All">;
  price: number;
  image: string;
  veg: boolean;
  available: boolean;
  prepMinutes: number;
  popular: boolean;
}
export interface Catalog {
  restaurants: Restaurant[];
  foods: Food[];
  routes: BusRoute[];
}
export interface Journey {
  routeId: string;
  busNumber: string;
  seatNumber: string;
  currentLocation: string;
  stopId: string;
  arrivalAt: string;
}
export interface OrderItem {
  foodId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}
export interface Order {
  _id: string;
  userId: string;
  restaurantId: string;
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  journey: Journey;
  stopName: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes: string;
  paymentMethod: "cod" | "razorpay";
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  refundId?: string;
  deliveryAgent?: string;
  deliveryPhone?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}
export interface CartItem {
  foodId: string;
  quantity: number;
}
export const ORDER_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  placed: "Order placed",
  accepted: "Confirmed",
  preparing: "In the kitchen",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 ? 2 : 0,
  }).format(paise / 100);
