"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Smartphone, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useApp } from "./app-provider";
import { Dialog } from "./dialog";
import { PasswordLogin } from "./password-login";
export function LoginDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { refreshUser, localSms, toast } = useApp();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [passwordMode, setPasswordMode] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!sent) {
        if (!/^[6-9]\d{9}$/.test(phone))
          throw new Error("Enter a valid 10-digit Indian mobile number.");
        if (Date.now() < resendAt)
          throw new Error(
            "Please wait a minute before requesting another code.",
          );
        const { error } = await authClient.phoneNumber.sendOtp({
          phoneNumber: `+91${phone}`,
        });
        if (error)
          throw new Error(
            error.message || "Couldn't send the verification code.",
          );
        setSent(true);
        setResendAt(Date.now() + 60000);
      } else {
        const { error } = await authClient.phoneNumber.verify({
          phoneNumber: `+91${phone}`,
          code,
        });
        if (error)
          throw new Error(error.message || "Check your code and try again.");
        await refreshUser();
        onClose();
        setSent(false);
        setCode("");
        toast("You’re in. Let’s find you something delicious.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        passwordMode
          ? "Login with password"
          : sent
            ? localSms
              ? "Check your terminal"
              : "Check your messages"
            : "Welcome aboard"
      }
    >
      {passwordMode ? (
        <PasswordLogin
          onSuccess={() => {
            onClose();
            setPasswordMode(false);
            setSent(false);
            setCode("");
          }}
        />
      ) : (
        <>
          <div className="login-illustration">
            <Smartphone size={34} />
            <span className="mini-spark">✦</span>
          </div>
          <p className="muted">
            {sent
              ? localSms
                ? `Enter the 6-digit code printed in your server terminal for +91 ${phone}.`
                : `Enter the 6-digit code sent to +91 ${phone}.`
              : "Good food is one quick login away. Enter your mobile number to get started."}
          </p>
          <form onSubmit={submit} className="form-stack">
            {!sent ? (
              <label>
                Mobile number
                <div className="phone-input">
                  <span>🇮🇳 +91</span>
                  <input
                    type="tel"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="Enter mobile number"
                    required
                    autoFocus
                  />
                </div>
              </label>
            ) : (
              <label>
                Verification code
                <input
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  autoFocus
                />
              </label>
            )}
            {localSms && (
              <div className="info-box">
                Local test mode:{" "}
                {sent ? "find your code" : "your code will appear"} in the
                terminal running <code>npm run dev</code>. Look for a line
                starting with <code>[Travel Bite local SMS]</code> and use the
                six digits after your phone number. This code expires after five
                minutes.
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" disabled={busy}>
              {busy
                ? "One moment…"
                : sent
                  ? "Verify & continue"
                  : "Get verification code"}
              <ArrowRight size={18} />
            </button>
            {sent && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError("");
                }}
              >
                Change number or resend code
              </button>
            )}
          </form>
        </>
      )}
      <div className="password-login-alternative">
        <span>or</span>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => {
            setPasswordMode(!passwordMode);
            setError("");
            setCode("");
          }}
        >
          {passwordMode ? "Login with OTP" : "Login with password"}
        </button>
      </div>
      <p className="secure-note">
        <ShieldCheck size={15} /> Your number is used for login and order
        updates.
      </p>
    </Dialog>
  );
}
