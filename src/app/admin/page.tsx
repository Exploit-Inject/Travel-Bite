import { AdminDashboard } from "@/components/admin-dashboard";
import { currentUser } from "@/lib/http";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin/login");
  return <AdminDashboard />;
}
