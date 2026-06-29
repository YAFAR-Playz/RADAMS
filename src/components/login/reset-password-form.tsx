"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";

type Status = "exchanging" | "ready" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [status, setStatus] = useState<Status>("exchanging");
  const [showPw, setShowPw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // The reset link may arrive as #access_token=... (no browser-side PKCE
      // verifier available — e.g. opened on a different device than the one
      // that requested it) or as ?code=... (same browser, PKCE). Handle both.
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        setStatus(sessionError ? "invalid" : "ready");
        return;
      }

      const code = searchParams.get("code");
      if (!code) {
        setStatus("invalid");
        return;
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      setStatus(exchangeError ? "invalid" : "ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createValid = newPw.length >= 8 && newPw === confirmPw;
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;

  async function handleCreatePassword() {
    if (!createValid) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (updateError) {
      setError(updateError.message || "Something went wrong. Please try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (status === "exchanging") {
    return <p className="text-[14.5px] text-[var(--muted)]">Verifying your reset link…</p>;
  }

  if (status === "invalid") {
    return (
      <>
        <div className="mb-[18px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--dangers)] text-[var(--danger)]">
          <Icon name="alert" size={24} />
        </div>
        <h1 className="m-0 mb-[7px] text-[27px] font-semibold text-[var(--text)] tracking-[-0.02em]">
          This link has expired
        </h1>
        <p className="m-0 mb-6 text-[14.5px] text-[var(--muted)] leading-relaxed">
          Reset links only work once and expire after a while. Go back and request a new one.
        </p>
        <Link
          href="/login"
          className="flex h-[50px] w-full items-center justify-center rounded-[var(--rad-sm)] bg-[var(--brand)] text-[15px] font-semibold text-[var(--brandfg)]"
        >
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="m-0 mb-[7px] text-[27px] font-semibold text-[var(--text)] tracking-[-0.02em]">
        Reset your password
      </h1>
      <p className="m-0 mb-[22px] text-[14.5px] text-[var(--muted)] leading-relaxed">
        Set a password to finish resetting your account.
      </p>
      <label className="text-[13px] font-semibold text-[var(--text)] block mb-2">New password</label>
      <div className="flex items-center gap-[9px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--rad-sm)] px-[13px] h-[50px] focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brands)]">
        <Icon name="shield" size={17} className="text-[var(--subtle)]" />
        <input
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          type={showPw ? "text" : "password"}
          placeholder="At least 8 characters"
          className="border-none outline-none bg-transparent text-[15px] text-[var(--text)] w-full h-full"
        />
        <button
          onClick={() => setShowPw((v) => !v)}
          className="bg-none border-none text-[var(--subtle)] cursor-pointer p-1 flex items-center"
        >
          <Icon name={showPw ? "eye-off" : "eye"} size={18} />
        </button>
      </div>
      <label className="text-[13px] font-semibold text-[var(--text)] block mt-[14px] mb-2">Confirm password</label>
      <div className="flex items-center gap-[9px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--rad-sm)] px-[13px] h-[50px] focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brands)]">
        <Icon name="shield" size={17} className="text-[var(--subtle)]" />
        <input
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          type={showPw ? "text" : "password"}
          placeholder="Re-enter password"
          className="border-none outline-none bg-transparent text-[15px] text-[var(--text)] w-full h-full"
        />
      </div>
      {pwMismatch && <div className="mt-[9px] text-[12.5px] text-[var(--danger)] font-medium">Passwords don&apos;t match yet.</div>}
      {error && <p className="mt-3 text-[12.5px] text-[var(--danger)] font-medium">{error}</p>}
      <button
        onClick={handleCreatePassword}
        disabled={!createValid || saving}
        className="mt-[18px] w-full h-[50px] rounded-[var(--rad-sm)] text-[var(--brandfg)] text-[15px] font-semibold"
        style={{
          background: createValid ? "var(--brand)" : "var(--subtle)",
          cursor: createValid ? "pointer" : "not-allowed",
        }}
      >
        {saving ? "Saving…" : "Create password & sign in"}
      </button>
    </>
  );
}
