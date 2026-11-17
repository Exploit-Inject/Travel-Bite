"use client";
import { useState, type FormEvent } from "react";
import { request } from "@/lib/client-api";
import { useApp } from "./app-provider";
export function AddPassword() {
  const { refreshUser, toast } = useApp();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await request("auth/phone-password/set-password", "POST", { password });
      setPassword("");
      setConfirm("");
      await refreshUser();
      toast(
        "Password added. You can now log in with your mobile number and password.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <h2>Add a password</h2>
      <p className="muted small" style={{ margin: "10px 0 18px" }}>
        Log in with your mobile number and password when you prefer.
      </p>
      <form onSubmit={submit} className="form-stack">
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            maxLength={128}
            placeholder="At least 12 characters"
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            maxLength={128}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </section>
  );
}
