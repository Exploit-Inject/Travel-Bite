"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { request } from "@/lib/client-api";
import { useApp } from "./app-provider";

export function PasswordLogin({ onSuccess }: { onSuccess: () => void }) {
  const { refreshUser, toast } = useApp();
  const [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!/^[6-9]\d{9}$/.test(phone))
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      if (register) {
        if (password !== confirmation)
          throw new Error("The passwords don't match.");
        await request("auth/phone-password/sign-up", "POST", {
          name,
          phoneNumber: `+91${phone}`,
          password,
        });
      } else {
        const result = await authClient.signIn.phoneNumber({
          phoneNumber: `+91${phone}`,
          password,
        });
        if (result.error)
          throw new Error(
            result.error.status === 429
              ? "Too many attempts. Please wait a minute."
              : "The mobile number or password is incorrect. If you used OTP before, log in with OTP and add a password in My account.",
          );
      }
      setPassword("");
      setConfirmation("");
      await refreshUser();
      onSuccess();
      toast(
        register ? "Account created. Welcome aboard." : "You’re logged in.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="muted" style={{ marginBottom: 18 }}>
        {register
          ? "Create your account with your full name, mobile number and a password."
          : "Use your mobile number and password to continue."}
      </p>
      <form onSubmit={submit} className="form-stack">
        {register && (
          <label>
            Full name
            <input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
        )}
        <label>
          Mobile number
          <div className="phone-input">
            <span>+91</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              required
            />
          </div>
        </label>
        <label htmlFor="customer-password">
          Password
          <div className="admin-password-field">
            <input
              id="customer-password"
              type={show ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={register ? 12 : undefined}
              maxLength={128}
              placeholder={
                register ? "At least 12 characters" : "Enter your password"
              }
              required
            />
            <button
              className="icon-button"
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        {register && (
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              maxLength={128}
              required
            />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy
            ? "Please wait…"
            : register
              ? "Create account & continue"
              : "Log in with password"}
          <ArrowRight size={18} />
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError("");
            setPassword("");
            setConfirmation("");
          }}
        >
          {register
            ? "Already have an account? Log in"
            : "New here? Create an account"}
        </button>
      </form>
    </>
  );
}
