"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { exitOnboardingDemo } from "@/lib/actions/onboarding";
import type { TourStep } from "@/lib/onboarding-tours/types";

const STEP_STORAGE_KEY = "onboarding-tour-step";
// Generous: a step's target page can take a real while to become
// interactive — several sequential data fetches on some tabs, plus (in dev)
// Turbopack's on-demand compile of a route not yet visited this session.
const FIND_TARGET_TIMEOUT_MS = 15000;
const FIND_TARGET_POLL_MS = 120;

function readStoredStep(max: number): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(STEP_STORAGE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n >= 0 && n < max ? n : 0;
}

export function TourRunner({ steps }: { steps: TourStep[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [stepIndex, setStepIndex] = useState(() => readStoredStep(steps.length));
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [finding, setFinding] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const step = steps[stepIndex] ?? null;

  useEffect(() => {
    window.sessionStorage.setItem(STEP_STORAGE_KEY, String(stepIndex));
  }, [stepIndex]);

  useEffect(() => {
    if (!step) return;
    if (pathname !== step.path) {
      router.push(step.path);
    }
  }, [step, pathname, router]);

  useEffect(() => {
    if (!step || pathname !== step.path) {
      const id = requestAnimationFrame(() => {
        setRect(null);
        setFinding(false);
      });
      return () => cancelAnimationFrame(id);
    }
    let cancelled = false;
    const startedAt = Date.now();
    const findingId = requestAnimationFrame(() => setFinding(true));

    function measure() {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step!.selector}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
        setFinding(false);
        return;
      }
      if (Date.now() - startedAt > FIND_TARGET_TIMEOUT_MS) {
        setRect(null);
        setFinding(false);
        return;
      }
      window.setTimeout(measure, FIND_TARGET_POLL_MS);
    }
    measure();

    function onViewportChange() {
      const el = document.querySelector(`[data-tour="${step!.selector}"]`);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(findingId);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [step, pathname]);

  const finish = useCallback(async (completed: boolean) => {
    setFinishing(true);
    try {
      await exitOnboardingDemo(completed);
    } finally {
      window.sessionStorage.removeItem(STEP_STORAGE_KEY);
      window.location.href = "/dashboard";
    }
  }, []);

  const goNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish(true);
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, steps.length, finish]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!step?.requireRealClick || !rect) return;
    const el = document.querySelector(`[data-tour="${step.selector}"]`);
    if (!el) return;
    const handler = () => goNext();
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [step, rect, goNext]);

  const tooltipStyle = useMemo(() => {
    if (!rect) return null;
    const gap = 14;
    const margin = 12;
    const cardWidth = Math.min(320, window.innerWidth - margin * 2);
    const cardHeightGuess = 190; // rough — enough to decide top vs. bottom on short viewports
    const base: React.CSSProperties = { position: "fixed", zIndex: 101, width: cardWidth };

    // Side placements ("left"/"right") need real horizontal room on both
    // sides of the card — on a narrow viewport (most phones, many tablets in
    // portrait) they never fit, so always stack vertically there instead.
    const roomOnRight = window.innerWidth - rect.right;
    const roomOnLeft = rect.left;
    const sideFits = window.innerWidth >= 640 && (roomOnRight >= cardWidth + gap + margin || roomOnLeft >= cardWidth + gap + margin);
    let placement = step?.placement ?? "bottom";
    if ((placement === "left" || placement === "right") && !sideFits) {
      placement = rect.top > window.innerHeight / 2 ? "top" : "bottom";
    } else if (placement === "left" && roomOnLeft < cardWidth + gap + margin) {
      placement = "right";
    } else if (placement === "right" && roomOnRight < cardWidth + gap + margin) {
      placement = "left";
    }

    const clampedLeft = Math.max(margin, Math.min(rect.left, window.innerWidth - cardWidth - margin));
    if (placement === "bottom") {
      const fitsBelow = window.innerHeight - rect.bottom - gap >= cardHeightGuess;
      return fitsBelow
        ? { ...base, top: rect.bottom + gap, left: clampedLeft }
        : { ...base, bottom: window.innerHeight - rect.top + gap, left: clampedLeft };
    }
    if (placement === "top") {
      const fitsAbove = rect.top - gap >= cardHeightGuess;
      return fitsAbove
        ? { ...base, bottom: window.innerHeight - rect.top + gap, left: clampedLeft }
        : { ...base, top: rect.bottom + gap, left: clampedLeft };
    }
    const clampedTop = Math.max(margin, Math.min(rect.top, window.innerHeight - cardHeightGuess - margin));
    if (placement === "left") return { ...base, top: clampedTop, right: window.innerWidth - rect.left + gap };
    return { ...base, top: clampedTop, left: rect.right + gap };
  }, [rect, step]);

  if (!steps.length || !step) return null;

  return (
    <>
      {finding && !rect && (
        <div className="fixed bottom-5 right-5 z-[101] flex items-center gap-[8px] rounded-full border border-[var(--border)] bg-[var(--surface)] px-[14px] py-[9px] text-[12.5px] font-semibold text-[var(--muted)] shadow-[var(--shadow)]">
          <Spinner size={13} />
          Finding the next step…
        </div>
      )}
      {rect && (
        <>
          {/* Four bars surrounding the target rect — dark, pointer-events:auto
              (blocks off-script clicks) — the target's own rect area has no
              overlay above it, so it stays naturally clickable. */}
          <div className="fixed inset-x-0 top-0 z-[100] bg-[rgba(8,10,20,0.55)]" style={{ height: Math.max(0, rect.top) }} />
          <div className="fixed inset-x-0 bottom-0 z-[100] bg-[rgba(8,10,20,0.55)]" style={{ top: rect.bottom }} />
          <div className="fixed left-0 z-[100] bg-[rgba(8,10,20,0.55)]" style={{ top: rect.top, height: rect.height, width: Math.max(0, rect.left) }} />
          <div className="fixed right-0 z-[100] bg-[rgba(8,10,20,0.55)]" style={{ top: rect.top, height: rect.height, left: rect.right }} />
          <div
            className="pointer-events-none fixed z-[100] rounded-[8px] ring-2 ring-[var(--brand)]"
            style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
          />
        </>
      )}
      {tooltipStyle && (
        <div
          style={tooltipStyle}
          className="flex flex-col gap-[10px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[16px] shadow-[var(--shadow)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">
              Step {stepIndex + 1} of {steps.length}
            </span>
            <button onClick={() => finish(false)} disabled={finishing} className="flex-none text-[var(--subtle)] hover:text-[var(--text)]">
              <Icon name="x" size={15} />
            </button>
          </div>
          <h3 className="m-0 text-[14.5px] font-semibold text-[var(--text)]">{step.title}</h3>
          <p className="m-0 text-[13px] leading-relaxed text-[var(--muted)]">{step.body}</p>
          <div className="mt-[4px] flex items-center justify-between gap-2">
            <button
              onClick={goBack}
              disabled={stepIndex === 0 || finishing}
              className="flex items-center gap-[5px] rounded-[8px] px-[10px] py-[7px] text-[12.5px] font-semibold text-[var(--muted)] disabled:opacity-40"
            >
              <Icon name="chev-left" size={14} />
              Back
            </button>
            {step.requireRealClick ? (
              <span className="flex items-center gap-[6px] text-[12px] font-semibold text-[var(--brand)]">
                <Icon name="target" size={14} />
                Click it to continue
              </span>
            ) : (
              <button
                onClick={goNext}
                disabled={finishing}
                className="flex items-center gap-[6px] rounded-[8px] bg-[var(--brand)] px-[14px] py-[8px] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {stepIndex >= steps.length - 1 ? "Finish" : "Next"}
                <Icon name="cr" size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
