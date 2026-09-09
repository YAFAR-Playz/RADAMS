"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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
// Once a target is found, re-confirm at this relaxed interval instead of
// stopping — cheap (a querySelector + a getBoundingClientRect) and catches
// a target that only settles into its final position/element after the
// first successful resolution.
const CONFIRM_POLL_MS = 500;
const TRANSITION = "top 220ms ease, left 220ms ease, right 220ms ease, bottom 220ms ease, width 220ms ease, height 220ms ease, opacity 200ms ease";

type Mode = "nav-menu" | "nav-link" | "content";
type Target = { el: Element; mode: Mode };

function isVisible(el: Element): boolean {
  return (el as HTMLElement).offsetParent !== null;
}

function readStoredStep(max: number): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(STEP_STORAGE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n >= 0 && n < max ? n : 0;
}

// The user drives every transition themselves — the engine never silently
// teleports them. When a step's content lives on a different route, it
// spotlights the real sidebar nav link (or, on mobile where the drawer
// starts closed, the hamburger menu first) and waits for a real click,
// exactly like reaching any other spotlighted button.
// The app renders more than one element for the same logical target at once
// — a desktop sidebar link and its mobile-drawer twin, or (for "settings")
// a third copy inside the account-menu dropdown — only one of which is
// actually visible at a time depending on viewport/open state. Picking the
// first DOM match regardless of visibility would sometimes spotlight a
// hidden element, so every match is checked and the first visible one wins.
function firstVisible(selector: string): Element | null {
  const all = document.querySelectorAll(selector);
  for (const el of all) {
    if (isVisible(el)) return el;
  }
  return null;
}

function resolveTarget(step: TourStep, pathname: string): Target | null {
  if (pathname === step.path) {
    const el = firstVisible(`[data-tour="${step.selector}"]`) ?? document.querySelector(`[data-tour="${step.selector}"]`);
    return el ? { el, mode: "content" } : null;
  }
  const key = step.path.replace(/^\//, "");
  const link = firstVisible(`[data-tour-nav="${key}"]`);
  if (link) return { el: link, mode: "nav-link" };
  const menu = firstVisible('[data-tour="nav-menu-toggle"]');
  if (menu) return { el: menu, mode: "nav-menu" };
  return null;
}

export function TourRunner({ steps }: { steps: TourStep[] }) {
  const pathname = usePathname();
  const [stepIndex, setStepIndex] = useState(() => readStoredStep(steps.length));
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [targetEl, setTargetEl] = useState<Element | null>(null);
  const [finding, setFinding] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [poke, setPoke] = useState(0);

  const step = steps[stepIndex] ?? null;

  useEffect(() => {
    window.sessionStorage.setItem(STEP_STORAGE_KEY, String(stepIndex));
  }, [stepIndex]);

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
    setStepIndex((i) => {
      if (i >= steps.length - 1) {
        finish(true);
        return i;
      }
      return i + 1;
    });
  }, [steps.length, finish]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let lastEl: Element | null = null;
    const startedAt = Date.now();
    // Clears whatever the previous step left on screen immediately, rather
    // than leaving it frozen there while this step's target is searched
    // for — otherwise, on a step whose target takes a moment to resolve (or
    // never resolves), the tooltip appears stuck showing the last step's
    // title/body forever, no matter how many times "Skip step" is pressed
    // (each press does move stepIndex forward — there's just nothing new
    // rendered yet to show for it). The CSS `transition` on position still
    // makes a *found* target glide smoothly from A to B; this only affects
    // the gap while nothing has been found yet.
    const findingId = requestAnimationFrame(() => {
      setFinding(true);
      setNotFound(false);
      setRect(null);
      setMode(null);
      setTargetEl(null);
    });

    // Keeps re-resolving even after a first match, at a relaxed interval,
    // for as long as this step is on screen — not just once. A first
    // resolution can be wrong in a way that never self-corrects otherwise:
    // e.g. the nav briefly renders narrower than its final layout (fonts,
    // async content, or a transient viewport size) so the engine falls
    // back to the mobile menu target, then the real layout settles a
    // moment later with no `resize`/`scroll` event to prompt a recheck.
    function measure(poll: number) {
      if (cancelled) return;
      const found = resolveTarget(step!, pathname);
      if (found) {
        lastEl = found.el;
        setRect(found.el.getBoundingClientRect());
        setMode(found.mode);
        setTargetEl(found.el);
        setFinding(false);
        window.setTimeout(() => measure(CONFIRM_POLL_MS), CONFIRM_POLL_MS);
        return;
      }
      if (!lastEl && Date.now() - startedAt > FIND_TARGET_TIMEOUT_MS) {
        setRect(null);
        setMode(null);
        setTargetEl(null);
        setFinding(false);
        setNotFound(true);
        return;
      }
      window.setTimeout(() => measure(poll), poll);
    }
    measure(FIND_TARGET_POLL_MS);

    function onViewportChange() {
      const found = resolveTarget(step!, pathname);
      if (found) {
        lastEl = found.el;
        setRect(found.el.getBoundingClientRect());
        setMode(found.mode);
        setTargetEl(found.el);
      }
    }
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(findingId);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [step, pathname, poke]);

  // Drives what a real click on the current target actually does: opening
  // the mobile drawer just re-triggers the search above (poke) so it can
  // then find the real nav link inside it; clicking a nav link needs no
  // handling at all — its own navigation changes `pathname`, which the
  // effect above already reacts to; a requireRealClick content target
  // advances the tour.
  useEffect(() => {
    if (!targetEl || !mode) return;
    if (mode === "nav-menu") {
      const handler = () => window.setTimeout(() => setPoke((p) => p + 1), 60);
      targetEl.addEventListener("click", handler);
      return () => targetEl.removeEventListener("click", handler);
    }
    if (mode === "content" && step?.requireRealClick) {
      const handler = () => goNext();
      targetEl.addEventListener("click", handler);
      return () => targetEl.removeEventListener("click", handler);
    }
  }, [targetEl, mode, step, goNext]);

  const tooltipStyle = useMemo(() => {
    if (!rect) return null;
    const gap = 14;
    const margin = 12;
    const cardWidth = Math.min(320, window.innerWidth - margin * 2);
    const cardHeightGuess = 190; // rough — enough to decide top vs. bottom on short viewports
    const base: React.CSSProperties = { position: "fixed", zIndex: 101, width: cardWidth, transition: TRANSITION };

    const placementPref = mode === "content" ? (step?.placement ?? "bottom") : "bottom";
    const roomOnRight = window.innerWidth - rect.right;
    const roomOnLeft = rect.left;
    const sideFits = window.innerWidth >= 640 && (roomOnRight >= cardWidth + gap + margin || roomOnLeft >= cardWidth + gap + margin);
    let placement = placementPref;
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
  }, [rect, step, mode]);

  if (!steps.length || !step) return null;

  const navCopy =
    mode === "nav-menu"
      ? { title: "Open the menu", body: "Tap the menu icon to open navigation." }
      : mode === "nav-link"
        ? { title: "Keep going", body: "Click this to head to the next part of the tour." }
        : null;

  return (
    <>
      <style>{`
        @keyframes tour-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 3px var(--brand), 0 0 14px 3px var(--brand); opacity: 0.85; }
          50% { box-shadow: 0 0 0 3px var(--brand), 0 0 24px 8px var(--brand); opacity: 1; }
        }
      `}</style>
      {finding && !rect && (
        <div className="fixed bottom-5 right-5 z-[101] flex items-center gap-[8px] rounded-full border border-[var(--border)] bg-[var(--surface)] px-[14px] py-[9px] text-[12.5px] font-semibold text-[var(--muted)] shadow-[var(--shadow)]">
          <Spinner size={13} />
          Finding the next step…
        </div>
      )}
      {notFound && !rect && (
        <div className="fixed bottom-5 right-5 z-[101] flex items-center gap-[10px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[12px_14px] shadow-[var(--shadow)]">
          <span className="text-[12.5px] font-medium text-[var(--muted)]">Couldn&apos;t find that on this page.</span>
          <button
            onClick={() => setPoke((p) => p + 1)}
            className="flex-none rounded-[8px] border border-[var(--border)] px-[10px] py-[6px] text-[12px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
          >
            Retry
          </button>
          <button
            onClick={goNext}
            className="flex-none rounded-[8px] bg-[var(--brand)] px-[10px] py-[6px] text-[12px] font-semibold text-[var(--brandfg)]"
          >
            Skip step
          </button>
        </div>
      )}
      {rect && (
        <>
          {/* Four bars surrounding the target rect — dim everything else for
              visual focus only. These are click-through (pointer-events-none)
              on every step, required or not: earlier they blocked clicks to
              anything outside the current target, which sounds like a
              helpful guardrail but in practice trapped the user mid-form —
              unable to fill in a field the tour hadn't gotten to yet, or
              even reach the "Exit demo" banner. Wandering off-script now
              just means the next step's own search may come up empty, which
              the "Couldn't find that — Retry / Skip step" fallback already
              handles gracefully. Transitions on position/size make moving
              between targets read as a smooth animated glide instead of an
              abrupt pop. */}
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] bg-[rgba(8,10,20,0.6)]" style={{ height: Math.max(0, rect.top - 6), transition: TRANSITION }} />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] bg-[rgba(8,10,20,0.6)]" style={{ top: rect.bottom + 6, transition: TRANSITION }} />
          <div
            className="pointer-events-none fixed left-0 z-[100] bg-[rgba(8,10,20,0.6)]"
            style={{ top: rect.top - 6, height: rect.height + 12, width: Math.max(0, rect.left - 6), transition: TRANSITION }}
          />
          <div
            className="pointer-events-none fixed right-0 z-[100] bg-[rgba(8,10,20,0.6)]"
            style={{ top: rect.top - 6, height: rect.height + 12, left: rect.right + 6, transition: TRANSITION }}
          />
          <div
            className="pointer-events-none fixed z-[100] rounded-[10px]"
            style={{
              top: rect.top - 5,
              left: rect.left - 5,
              width: rect.width + 10,
              height: rect.height + 10,
              transition: TRANSITION,
              animation: "tour-glow-pulse 1.8s ease-in-out infinite",
            }}
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
          <h3 className="m-0 text-[14.5px] font-semibold text-[var(--text)]">{navCopy?.title ?? step.title}</h3>
          <p className="m-0 text-[13px] leading-relaxed text-[var(--muted)]">{navCopy?.body ?? step.body}</p>
          {navCopy ? (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-[6px] text-[12px] font-semibold text-[var(--brand)]">
                <Icon name="target" size={14} />
                Click it to continue
              </span>
              <button onClick={goNext} disabled={finishing} className="flex-none text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--text)]">
                Skip step
              </button>
            </div>
          ) : (
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
                <div className="flex items-center gap-[12px]">
                  <button onClick={goNext} disabled={finishing} className="flex-none text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--text)]">
                    Skip step
                  </button>
                  <span className="flex items-center gap-[6px] text-[12px] font-semibold text-[var(--brand)]">
                    <Icon name="target" size={14} />
                    Click it to continue
                  </span>
                </div>
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
          )}
        </div>
      )}
    </>
  );
}
