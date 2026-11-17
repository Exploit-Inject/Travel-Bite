import { redirect } from "next/navigation";
import { currentUser } from "@/lib/http";
import { AdminLogin } from "@/components/admin-login";
export const metadata = {
  title: "Admin login",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentUser();
  if (user?.role === "admin") redirect("/admin");
  return <AdminLogin />;
}
