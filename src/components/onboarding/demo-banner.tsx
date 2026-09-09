"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { exitOnboardingDemo } from "@/lib/actions/onboarding";

// Rendered on every page while profile.isTouringDemo is true — not just
// during active guided steps — so it's the recovery path if someone
// navigates off-script, reloads, or closes the tab and comes back later.
// profiles.pre_demo_org_id durably remembers their way home regardless.
export function DemoBanner() {
  const [exiting, setExiting] = useState(false);

  async function onExit() {
    setExiting(true);
    try {
      await exitOnboardingDemo(false);
    } finally {
      window.sessionStorage.removeItem("onboarding-tour-step");
      window.location.href = "/dashboard";
    }
  }

  return (
    // z-[110] — above the onboarding tour's dimming overlay (z-[100]) and
    // tooltip (z-101), so this escape hatch always stays clickable even
    // while a step is actively spotlighting something elsewhere on the
    // page. Without this, the tour's own "block off-script clicks" bars
    // (by design) swallow clicks anywhere outside the current target —
    // including this banner.
    <div className="sticky top-0 z-[110] flex items-center justify-center gap-[10px] bg-[var(--brand)] px-4 py-[9px] text-[13px] font-semibold text-[var(--brandfg)]">
      <Icon name="target" size={15} />
      You&apos;re viewing a demo — nothing here is real, and it&apos;s thrown away when you exit.
      <button
        onClick={onExit}
        disabled={exiting}
        className="flex items-center gap-[6px] rounded-full bg-[rgba(255,255,255,0.22)] px-[12px] py-[4px] text-[12px] font-semibold hover:bg-[rgba(255,255,255,0.32)] disabled:opacity-60"
      >
        {exiting ? <Spinner size={12} /> : <Icon name="x" size={12} />}
        Exit demo
      </button>
    </div>
  );
}
