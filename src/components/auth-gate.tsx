"use client";
import Link from "next/link";
import { ArrowRight, LockKeyhole, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "./app-provider";
import type { Role } from "@/lib/types";
export function AuthGate({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const { user, authLoading, login } = useApp();
  if (authLoading)
    return (
      <div className="empty-state">
        <LoaderCircle className="spin" size={30} />
        <p>Getting things ready…</p>
      </div>
    );
  if (!user)
    return (
      <div className="empty-state">
        <LockKeyhole size={42} />
        <h1>A quick login, then you’re in.</h1>
        <p>Use your mobile number to access your account.</p>
        <button className="button" onClick={login}>
          Log in to continue
          <ArrowRight size={17} />
        </button>
      </div>
    );
  if (roles && !roles.includes(user.role))
    return (
      <div className="empty-state">
        <LockKeyhole size={42} />
        <h1>This workspace is restricted.</h1>
        <p>Your account doesn’t have access to this page.</p>
        <Link className="button button-outline" href="/account">
          Back to my account
          <ArrowRight size={17} />
        </Link>
      </div>
    );
  return children;
}
