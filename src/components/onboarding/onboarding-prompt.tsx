"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { startOnboardingDemo, markOnboardingSkipped } from "@/lib/actions/onboarding";

// Shown once per app-shell mount while onboarding_tour_status === "pending"
// for a supported role — "pop up every login until completed or skipped"
// per the onboarding-tour plan. "Maybe later" only dismisses this mount
// (session-only); "Skip" persists so it never comes back.
export function OnboardingPrompt() {
  const [dismissed, setDismissed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  async function onStart() {
    setStarting(true);
    setError(null);
    try {
      await startOnboardingDemo();
      window.location.href = "/dashboard";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the tour — try again.");
      setStarting(false);
    }
  }

  async function onSkip() {
    setSkipping(true);
    try {
      await markOnboardingSkipped();
      setDismissed(true);
    } catch {
      setSkipping(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex w-[340px] flex-col gap-[10px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[16px] shadow-[var(--shadow)]">
      <div className="flex items-start gap-[10px]">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[var(--brand)]">
          <Icon name="target" size={17} />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Want a quick tour?</h3>
          <p className="m-0 mt-[2px] text-[12.5px] leading-relaxed text-[var(--muted)]">
            A few minutes, guided step by step, in a demo you can&apos;t break — real screens, real data, thrown away when you&apos;re done.
          </p>
        </div>
      </div>
      {error && <p className="m-0 text-[12px] font-medium text-[var(--danger)]">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setDismissed(true)}
          disabled={starting || skipping}
          className="text-[12.5px] font-semibold text-[var(--subtle)] hover:text-[var(--text)]"
        >
          Maybe later
        </button>
        <div className="flex items-center gap-[8px]">
          <button
            onClick={onSkip}
            disabled={starting || skipping}
            className="rounded-[8px] px-[10px] py-[7px] text-[12.5px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
          >
            {skipping ? <Spinner size={13} /> : "Skip"}
          </button>
          <button
            onClick={onStart}
            disabled={starting || skipping}
            className="flex items-center gap-[6px] rounded-[8px] bg-[var(--brand)] px-[14px] py-[8px] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
          >
            {starting ? <Spinner size={13} /> : "Start tour"}
          </button>
        </div>
      </div>
    </div>
  );
}
