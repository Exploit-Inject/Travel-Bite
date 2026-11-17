"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { request } from "@/lib/client-api";
import { useApp, type User } from "./app-provider";

export function AdminLogin() {
  const router = useRouter();
  const { refreshUser, user } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        rememberMe: false,
      });
      if (result.error)
        throw new Error(
          result.error.status === 429
            ? "Too many login attempts. Please wait a minute and try again."
            : "The email or password is incorrect.",
        );
      const { user: account } = await request<{ user: User | null }>("me");
      if (account?.role !== "admin") {
        await authClient.signOut();
        await refreshUser();
        throw new Error("This account does not have administrator access.");
      }
      setPassword("");
      await refreshUser();
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn't sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page-shell admin-login-page">
      <section className="panel admin-login-panel">
        <span className="admin-login-icon">
          <LockKeyhole size={29} />
        </span>
        <div className="eyebrow">TRAVEL BITE ADMINISTRATION</div>
        <h1>Welcome back, admin.</h1>
        <p className="muted">
          Sign in with your administrator email and password.
        </p>
        {user && (
          <p className="info-box">
            Signing in will switch from your current account to the
            administrator account.
          </p>
        )}
        <form className="form-stack" onSubmit={submit}>
          <label htmlFor="admin-email">
            Admin email
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              placeholder="Your admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              disabled={busy}
              required
            />
          </label>
          <label htmlFor="admin-password">
            Password
            <div className="admin-password-field">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                disabled={busy}
                required
              />
              <button
                type="button"
                className="icon-button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                <span>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </span>
              </button>
            </div>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in to dashboard"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="secure-note">
          <ShieldCheck size={15} />
          Administrator access only
        </p>
        <p className="small muted admin-login-help">
          For account setup or a password reset, contact the person managing
          your Travel Bite server.
        </p>
      </section>
    </div>
  );
}
