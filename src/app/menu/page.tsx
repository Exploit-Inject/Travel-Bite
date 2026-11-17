import { FoodMenu } from "@/components/food-menu";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Explore the menu" };
export default function Page() {
  return <FoodMenu full />;
}
