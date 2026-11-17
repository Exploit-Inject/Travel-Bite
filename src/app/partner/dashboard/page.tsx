import { PartnerDashboard } from "@/components/partner-dashboard";
export const metadata = {
  title: "Partner workspace",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <PartnerDashboard />;
}
