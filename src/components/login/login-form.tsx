"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signInWithPassword } from "@/lib/actions/auth";
import { authErrorMessage } from "@/lib/auth-error";
import { Icon } from "@/components/icons";

type Step = "contact" | "password" | "sent";
type Method = "email" | "phone";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const RESEND_SECONDS = 30;

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("contact");
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== "sent" || resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [step, resendIn]);

  const emailValid = EMAIL_RE.test(email);
  const contactValid = method === "email" ? emailValid : false;
  const contactDisplay = email || "you@example.com";

  function goBack() {
    setError(null);
    setStep((s) => (s === "sent" ? "password" : "contact"));
  }

  function handleContinue() {
    if (!contactValid) return;
    setError(null);
    setStep("password");
  }

  async function handleSignIn() {
    if (password.length < 1) return;
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await signInWithPassword(email, password);
      if (signInError) {
        setError(signInError);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendResetCode() {
    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        setError(authErrorMessage(resetError));
        return;
      }
      setResendIn(RESEND_SECONDS);
      setStep("sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      {step === "contact" && (
        <>
          <h1 className="m-0 mb-[7px] text-[27px] font-semibold text-[var(--text)] tracking-[-0.02em]">
            Sign in to your account
          </h1>
          <p className="m-0 mb-[22px] text-[14.5px] text-[var(--muted)] leading-relaxed">
            Enter your email or phone to continue.
          </p>
          <div className="flex gap-1 bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] p-[3px] mb-[18px]">
            <button
              onClick={() => setMethod("email")}
              className="flex-1 flex items-center justify-center gap-[7px] h-[38px] rounded-[8px] text-[13.5px] font-semibold cursor-pointer"
              style={{
                background: method === "email" ? "var(--surface)" : "transparent",
                color: method === "email" ? "var(--text)" : "var(--muted)",
                boxShadow: method === "email" ? "var(--shadow)" : "none",
              }}
            >
              <Icon name="mail" size={16} />
              Email
            </button>
            <button
              onClick={() => setMethod("phone")}
              className="flex-1 flex items-center justify-center gap-[7px] h-[38px] rounded-[8px] text-[13.5px] font-semibold cursor-pointer"
              style={{
                background: method === "phone" ? "var(--surface)" : "transparent",
                color: method === "phone" ? "var(--text)" : "var(--muted)",
                boxShadow: method === "phone" ? "var(--shadow)" : "none",
              }}
            >
              <Icon name="phone" size={16} />
              Phone
            </button>
          </div>

          {method === "email" ? (
            <>
              <label className="text-[13px] font-semibold text-[var(--text)] block mb-2">
                Email address
              </label>
              <div className="flex items-center gap-[9px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--rad-sm)] px-[13px] h-[50px] focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brands)]">
                <Icon name="mail" size={17} className="text-[var(--subtle)]" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="border-none outline-none bg-transparent text-[15px] text-[var(--text)] w-full h-full"
                />
              </div>
            </>
          ) : (
            <>
              <label className="text-[13px] font-semibold text-[var(--text)] block mb-2">
                Phone number
              </label>
              <div className="flex items-center gap-[9px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--rad-sm)] px-[13px] h-[50px] opacity-60">
                <Icon name="phone" size={17} className="text-[var(--subtle)]" />
                <input
                  disabled
                  placeholder="Phone sign-in is coming soon"
                  className="border-none outline-none bg-transparent text-[15px] text-[var(--text)] w-full h-full cursor-not-allowed"
                />
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--subtle)]">
                Phone sign-in isn&apos;t available yet — please use email for now.
              </p>
            </>
          )}

          <button
            onClick={handleContinue}
            disabled={!contactValid}
            className="mt-[22px] w-full h-[50px] rounded-[var(--rad-sm)] text-[var(--brandfg)] text-[15px] font-semibold flex items-center justify-center gap-2"
            style={{
              background: contactValid ? "var(--brand)" : "var(--subtle)",
              cursor: contactValid ? "pointer" : "not-allowed",
            }}
          >
            Continue
            <Icon name="arrow-r" size={17} />
          </button>
          <p className="mt-[18px] text-[12.5px] text-[var(--subtle)] leading-relaxed text-center">
            By continuing you agree to the Terms of Service and Privacy Policy.
          </p>
        </>
      )}

      {step === "password" && (
        <>
          <button
            onClick={goBack}
            className="flex items-center gap-[6px] bg-none border-none text-[var(--muted)] text-[13px] font-semibold cursor-pointer p-0 mb-4"
          >
            <Icon name="arrow-r" size={15} className="rotate-180" />
            {contactDisplay}
          </button>
          <h1 className="m-0 mb-[7px] text-[27px] font-semibold text-[var(--text)] tracking-[-0.02em]">
            Enter your password
          </h1>
          <p className="m-0 mb-[22px] text-[14.5px] text-[var(--muted)] leading-relaxed">
            Welcome back. Enter your password to sign in.
          </p>
          <label className="text-[13px] font-semibold text-[var(--text)] block mb-2">Password</label>
          <div className="flex items-center gap-[9px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--rad-sm)] px-[13px] h-[50px] focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brands)]">
            <Icon name="shield" size={17} className="text-[var(--subtle)]" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              placeholder="Your password"
              className="border-none outline-none bg-transparent text-[15px] text-[var(--text)] w-full h-full"
              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
            />
            <button
              onClick={() => setShowPw((v) => !v)}
              className="bg-none border-none text-[var(--subtle)] cursor-pointer p-1 flex items-center"
            >
              <Icon name={showPw ? "eye-off" : "eye"} size={18} />
            </button>
          </div>
          <div className="flex justify-end mt-[10px]">
            <button
              onClick={sendResetCode}
              disabled={loading}
              className="bg-none border-none text-[var(--brand)] text-[13px] font-semibold cursor-pointer p-0 disabled:opacity-60"
            >
              Forgot password?
            </button>
          </div>
          {error && <p className="mt-3 text-[12.5px] text-[var(--danger)] font-medium">{error}</p>}
          <button
            onClick={handleSignIn}
            disabled={password.length < 1 || loading}
            className="mt-4 w-full h-[50px] rounded-[var(--rad-sm)] text-[var(--brandfg)] text-[15px] font-semibold"
            style={{
              background: password.length >= 1 ? "var(--brand)" : "var(--subtle)",
              cursor: password.length >= 1 ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </>
      )}

      {step === "sent" && (
        <>
          <button
            onClick={goBack}
            className="flex items-center gap-[6px] bg-none border-none text-[var(--muted)] text-[13px] font-semibold cursor-pointer p-0 mb-4"
          >
            <Icon name="arrow-r" size={15} className="rotate-180" />
            Back
          </button>
          <div className="mb-[18px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--brands)] text-[var(--brand)]">
            <Icon name="mail" size={24} />
          </div>
          <h1 className="m-0 mb-[7px] text-[27px] font-semibold text-[var(--text)] tracking-[-0.02em]">
            Check your email
          </h1>
          <p className="m-0 mb-6 text-[14.5px] text-[var(--muted)] leading-relaxed">
            We sent a password reset link to <span className="text-[var(--text)] font-semibold">{contactDisplay}</span>.
            Open it on this device to set a new password.
          </p>
          {error && <p className="mb-3 text-[12.5px] text-[var(--danger)] font-medium">{error}</p>}
          <div className="flex items-center text-[13px]">
            {resendIn > 0 ? (
              <span className="text-[var(--subtle)]">Resend email in {resendIn}s</span>
            ) : (
              <button
                onClick={sendResetCode}
                disabled={loading}
                className="bg-none border-none text-[var(--brand)] font-semibold cursor-pointer p-0 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Resend email"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
