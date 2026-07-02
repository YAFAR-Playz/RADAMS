import { Suspense } from "react";
import { AuthCallback } from "@/components/login/auth-callback";

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--bg)] p-10">
      <div className="w-full max-w-[360px]">
        <div className="mb-9 flex items-center gap-[11px]">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-[var(--brand)] text-[20px] font-bold tracking-[-0.02em] text-[var(--brandfg)]">
            R
          </div>
          <span className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">ZAD-AMS</span>
        </div>
        <Suspense fallback={<p className="text-[14.5px] text-[var(--muted)]">Signing you in…</p>}>
          <AuthCallback />
        </Suspense>
      </div>
    </div>
  );
}

export function generateMetadata() {
  return { title: "Signing in — ZAD-AMS" };
}
