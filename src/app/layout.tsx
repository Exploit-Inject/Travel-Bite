import type { Metadata } from "next";
import { getCatalog } from "@/lib/db";
import { AppProvider } from "@/components/app-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000"),
  title: {
    default: "Travel Bite — Good food. Every mile.",
    template: "%s | Travel Bite",
  },
  description:
    "Fresh meals from restaurants along your bus route. Choose a stop, order your favourites, and enjoy the journey.",
  applicationName: "Travel Bite",
  manifest: "/manifest.webmanifest",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let catalog,
    unavailable = false;
  try {
    catalog = await getCatalog();
  } catch {
    catalog = { foods: [], restaurants: [], routes: [] };
    unavailable = true;
  }
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AppProvider
          catalog={JSON.parse(JSON.stringify(catalog))}
          unavailable={unavailable}
        >
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
