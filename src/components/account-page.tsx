"use client";
import Link from "next/link";
import {
  ArrowRight,
  BusFront,
  ChefHat,
  LogOut,
  Settings2,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useApp } from "./app-provider";
import { AuthGate } from "./auth-gate";
import { AddPassword } from "./add-password";
export function AccountPage() {
  const { user, refreshUser, editJourney, journey, toast } = useApp();
  return (
    <div className="container page-shell narrow-page">
      <AuthGate>
        <div className="page-heading">
          <div className="eyebrow">YOUR TRAVEL COMPANION</div>
          <h1>
            Welcome aboard
            {user?.name && user.name !== "Traveller" ? `, ${user.name}` : ""}.
          </h1>
          <p>Everything for your next delicious journey.</p>
        </div>
        <div className="account-card panel">
          <span className="account-avatar">
            <UserRound size={30} />
          </span>
          <div>
            <h2>{user?.name}</h2>
            <p className="muted">{user?.phone || user?.email}</p>
          </div>
          <span className="badge badge-green">
            {user?.phone
              ? user.phoneVerified
                ? "Verified mobile"
                : "Password account"
              : "Admin account"}
          </span>
        </div>
        {user?.phone && !user.passwordEnabled && <AddPassword />}
        <div className="account-links">
          <Link href="/orders">
            <ShoppingBag size={23} />
            <span>
              <strong>My orders</strong>
              <small>Track your meals and view previous orders</small>
            </span>
            <ArrowRight size={19} />
          </Link>
          <button onClick={editJourney}>
            <BusFront size={23} />
            <span>
              <strong>My journey</strong>
              <small>
                {journey
                  ? `${journey.busNumber} · Seat ${journey.seatNumber}`
                  : "Set your bus details and delivery stop"}
              </small>
            </span>
            <ArrowRight size={19} />
          </button>
          <Link href="/partner/dashboard">
            <ChefHat size={23} />
            <span>
              <strong>Restaurant workspace</strong>
              <small>Register a kitchen or manage your restaurant</small>
            </span>
            <ArrowRight size={19} />
          </Link>
          {user?.role === "admin" && (
            <Link href="/admin">
              <Settings2 size={23} />
              <span>
                <strong>Admin dashboard</strong>
                <small>Manage orders, restaurants, routes and customers</small>
              </span>
              <ArrowRight size={19} />
            </Link>
          )}
        </div>
        <button
          className="text-button danger"
          onClick={async () => {
            const { error } = await authClient.signOut();
            if (error) {
              toast(error.message || "Couldn't sign out.", true);
              return;
            }
            await refreshUser();
            toast("You’re signed out. See you on the next journey.");
          }}
        >
          <LogOut size={16} />
          Log out
        </button>
      </AuthGate>
    </div>
  );
}
