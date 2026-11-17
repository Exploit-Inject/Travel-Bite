"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BusFront,
  ChevronDown,
  MapPin,
  ShoppingBag,
  UserRound,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "./app-provider";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`logo ${light ? "logo-light" : ""}`}
      aria-label="Travel Bite home"
    >
      <span className="logo-icon">
        <BusFront size={24} strokeWidth={2.1} />
        <span className="logo-spark">✦</span>
      </span>
      <span>
        travel<span className="brand-orange">bite</span>
        <span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
export function Header() {
  const { user, cart, login, openBag, journey, editJourney, catalog } =
    useApp();
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  const stop = catalog.routes
    .flatMap((r) => r.stops)
    .find((s) => s.id === journey?.stopId);
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link className={path === "/menu" ? "active" : ""} href="/menu">
            Explore menu
          </Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/partner">
            Partner with us
            <ArrowUpRight size={14} />
          </Link>
        </nav>
        <div className="header-actions">
          <button className="header-location" onClick={editJourney}>
            <MapPin size={17} />
            <span>{stop?.city || "Set your journey"}</span>
            <ChevronDown size={14} />
          </button>
          <span className="header-divider" />
          {user ? (
            <Link className="login-button" href="/account" aria-label="My account">
              <UserRound size={17} />
              <span>My account</span>
            </Link>
          ) : (
            <button className="login-button" onClick={login} aria-label="Log in">
              <UserRound size={17} />
              <span>Log in</span>
            </button>
          )}
          <button
            className="bag-button"
            onClick={openBag}
            aria-label={`Open food bag, ${count} items`}
          >
            <ShoppingBag size={19} />
            <span className="bag-label">Bag</span>
            <span className="bag-count">{count}</span>
          </button>
          <button
            className="mobile-menu-button icon-button"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle menu"
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav
          className="mobile-nav"
          aria-label="Mobile navigation"
          onClick={() => setMobile(false)}
        >
          <Link href="/menu">Explore menu</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/partner">Partner with us</Link>
          <Link href="/orders">My orders</Link>
          <Link href="/account">My account</Link>
        </nav>
      )}
    </header>
  );
}
