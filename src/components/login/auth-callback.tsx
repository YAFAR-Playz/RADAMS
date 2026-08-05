"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";

export function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      // Admin-generated links (Login as) verify server-side and redirect
      // with the session in the URL hash (#access_token=...), since there's
      // no browser-side PKCE verifier for a link nobody's browser requested.
      // Self-requested links (password reset, run from the same browser)
      // use a ?code= instead. Handle whichever one shows up.
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          setFailed(true);
          return;
        }
        // This branch always replaces an existing session (an admin's own,
        // for Login As) rather than establishing a fresh one — router.push +
        // router.refresh() is a soft navigation that can fire its server
        // request before the browser has finished persisting setSession()'s
        // new cookie, so the server still reads the old session and the
        // page loads back into the same account. A hard navigation only
        // fires after this async function's cookie writes are flushed.
        window.location.href = "/dashboard";
        return;
      }

      const code = searchParams.get("code");
      if (!code) {
        setFailed(true);
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setFailed(true);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <>
        <div className="mb-[18px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--dangers)] text-[var(--danger)]">
          <Icon name="alert" size={24} />
        </div>
        <h1 className="m-0 mb-[7px] text-[27px] font-semibold text-[var(--text)] tracking-[-0.02em]">
          This link has expired
        </h1>
        <p className="m-0 mb-6 text-[14.5px] text-[var(--muted)] leading-relaxed">
          Sign-in links only work once and expire after a while. Try again from where you got this link.
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

  return <p className="text-[14.5px] text-[var(--muted)]">Signing you in…</p>;
}
