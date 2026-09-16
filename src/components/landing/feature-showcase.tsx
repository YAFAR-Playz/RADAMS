"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { FeatureVisual } from "@/components/landing/feature-visuals";
import { TiltCard } from "@/components/landing/tilt-card";
import type { FeatureKey, LandingCopy } from "@/lib/landing-copy";

const ORDER: FeatureKey[] = ["attendance", "assignments", "payroll", "weakTopics", "messaging", "reports"];
const CARD_GAP = 190;

// How much of each item's scroll range (in units of `offset`, where 1 unit
// = the gap between two adjacent items) holds the card perfectly still,
// sharp and fully opaque before it starts sliding/fading toward its
// neighbor. Previously there was no plateau at all — opacity/scale started
// falling away from the very first pixel of scroll past dead-center, so the
// "fully clear" moment was a single infinitesimal scroll position, forcing
// very slow, precise scrolling to land on it. Widening this to a real
// plateau (applied to every derived value below via `settle`) keeps the
// same continuous, smooth interpolation everywhere else — it just gives
// the reader room to stop before the transition begins.
const SETTLE_ZONE = 0.22;

// Each card's position is a pure function of continuous scroll progress via
// useTransform chains — Framer Motion applies these directly without going
// through React state/re-renders, so the wheel moves smoothly every scroll
// frame without the cost (and the "one step behind" feel) of a React
// setState-per-frame loop. `active` (used only for the dot rail below)
// still exists as real state, but it only actually changes 6 times total —
// React bails out on a same-value setState, so it doesn't fight this.
function useOffset(scrollYProgress: MotionValue<number>, index: number) {
  return useTransform(scrollYProgress, (v) => index - v * ORDER.length);
}

// Clamps the plateau: holds at exactly 0 within SETTLE_ZONE of center, then
// continues as the same linear ramp beyond it (shifted so it's continuous,
// no jump at the boundary) — this is what every offset-driven value below
// is derived from, so the whole card (position/tilt/opacity/scale) freezes
// in its clearest pose for a real range of scroll instead of a single point.
function settle(offset: number) {
  const abs = Math.abs(offset);
  return abs <= SETTLE_ZONE ? 0 : Math.sign(offset) * (abs - SETTLE_ZONE);
}

// The front/active card (offset ≈ 0) stays sharp, full-size and fully
// opaque; neighbors recede clearly — smaller, dimmer, and tilted away on
// the X axis like they're rolling around a wheel behind the front card,
// not just fading in place next to it at equal weight.
function VisualCard({ scrollYProgress, index, brand, featureKey }: { scrollYProgress: MotionValue<number>; index: number; brand: string; featureKey: FeatureKey }) {
  const rawOffset = useOffset(scrollYProgress, index);
  const offset = useTransform(rawOffset, settle);
  const y = useTransform(offset, (o) => o * CARD_GAP);
  const rotateX = useTransform(offset, (o) => Math.max(-48, Math.min(48, o * -34)));
  const opacity = useTransform(offset, (o) => Math.max(0, 1 - Math.abs(o) * 0.62));
  const scale = useTransform(offset, (o) => Math.max(0.52, 1 - Math.abs(o) * 0.34));
  const zIndex = useTransform(offset, (o) => Math.round((1 - Math.min(Math.abs(o), 1)) * 10));
  const pointerEvents = useTransform(offset, (o) => (Math.abs(o) < 0.5 ? "auto" : "none"));

  return (
    <motion.div style={{ y, opacity, scale, rotateX, zIndex, pointerEvents }} className="absolute inset-0 [transform-style:preserve-3d]">
      <TiltCard className="h-full w-full [transform-style:preserve-3d]">
        <FeatureVisual feature={featureKey} brand={brand} />
      </TiltCard>
    </motion.div>
  );
}

function TextBlock({ scrollYProgress, index, title, body, brand }: { scrollYProgress: MotionValue<number>; index: number; title: string; body: string; brand: string }) {
  const rawOffset = useOffset(scrollYProgress, index);
  const offset = useTransform(rawOffset, settle);
  const y = useTransform(offset, (o) => o * 22);
  const opacity = useTransform(offset, (o) => Math.max(0, 1 - Math.abs(o) * 2.4));
  const pointerEvents = useTransform(offset, (o) => (Math.abs(o) < 0.5 ? "auto" : "none"));

  return (
    <motion.div
      style={{ y, opacity, pointerEvents }}
      className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
    >
      <h3 className="m-0 mb-[14px] text-[30px] font-bold leading-[1.2] tracking-[-0.01em]" style={{ color: brand }}>
        {title}
      </h3>
      <p className="m-0 max-w-[420px] text-[15px] leading-[1.65] text-[var(--muted)]">{body}</p>
    </motion.div>
  );
}

// Desktop: a pinned/sticky scroll-driven showcase. The mockups on the right
// sit in a vertical wheel/carousel — the active one centered and in front,
// with the previous and next ones peeking from behind above and below,
// continuously sliding as you scroll (in either direction). A centered text
// block on the left tracks the same continuous position. A vertical dot
// rail on the side lets you jump straight to any feature. Mobile falls back
// to a plain stacked grid below — a 500vh scroll-jacked layout doesn't
// translate to a narrow screen, so it isn't worth forcing.
export function FeatureShowcase({ copy, brand }: { copy: LandingCopy; brand: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });

  // A card is "settled"/sharp (offset ≈ 0, see useOffset above) exactly when
  // scrollYProgress === k / ORDER.length for its index k — i.e. exactly the
  // boundary Math.floor rounds down at. Floating-point arithmetic on scroll
  // position routinely lands a hair below that exact ratio (e.g.
  // 2.999999994 instead of 3), so floor() reported the PREVIOUS card as
  // active for the entire time a card sat fully sharp on screen — the dot
  // rail looked permanently one behind, only "catching up" once the reader
  // scrolled well into the next card. Math.round is immune to that
  // sub-pixel floating-point noise since it isn't sitting on a knife edge.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(ORDER.length - 1, Math.max(0, Math.round(v * ORDER.length)));
    setActive(idx);
  });

  function jumpTo(i: number) {
    const el = containerRef.current;
    if (!el) return;
    // `offset` (see useOffset above) is exactly 0 — the card's single
    // sharpest, most-settled position — when scrollYProgress === i / ORDER.length,
    // not the midpoint of the item's "slot". The previous `(i + 0.5) / ORDER.length`
    // landed exactly halfway between two cards' settled points, which is why a
    // dot click always dropped the reader mid-transition instead of on a clear,
    // fully-formed card.
    const progress = i / ORDER.length;
    // `el.offsetTop` is relative to the nearest *positioned* ancestor (here,
    // the enclosing `<section className="relative ...">`), not the document
    // — using it directly as an absolute scroll target was off by however
    // far that section itself sits from the page top, which in practice
    // landed close to a full card's worth of scroll away from intended.
    // getBoundingClientRect().top + the current scroll position gives the
    // real document-relative top regardless of any positioned ancestors.
    const absoluteTop = el.getBoundingClientRect().top + window.scrollY;
    const top = absoluteTop + progress * (el.offsetHeight - window.innerHeight);
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <>
      {/* Desktop pinned showcase */}
      <div ref={containerRef} className="relative hidden lg:block" style={{ height: `${ORDER.length * 85}vh` }}>
        {/* top-[64px]/h-[calc(100vh-64px)] (not top-0/h-screen) so this sticks
            just below the sticky header instead of underneath it — otherwise
            the header's own sticky layer covers whatever centers near the
            top of this box, clipping the first item behind it. */}
        <div className="sticky top-[64px] flex h-[calc(100vh-64px)] items-center justify-center overflow-hidden px-10 xl:px-16">
          {/* Dots are a normal flex sibling with their own reserved width
              (not absolutely positioned over the grid), so they can never
              overlap the wheel at narrower "lg" widths — the grid just
              shrinks to fit next to them. */}
          <div className="flex w-full max-w-[1360px] items-center gap-[28px]">
            <div className="grid flex-1 grid-cols-2 items-center gap-[64px] overflow-hidden">
              <div className="relative h-[260px]">
                {ORDER.map((key, i) => (
                  <TextBlock
                    key={key}
                    scrollYProgress={scrollYProgress}
                    index={i}
                    title={copy.features.items[key].title}
                    body={copy.features.items[key].body}
                    brand={brand}
                  />
                ))}
              </div>
              <div className="relative h-[420px]" style={{ perspective: 1400 }}>
                {ORDER.map((key, i) => (
                  <VisualCard key={key} scrollYProgress={scrollYProgress} index={i} brand={brand} featureKey={key} />
                ))}
              </div>
            </div>

            {/* Vertical dot rail — one per feature, click to jump straight
                there instead of scrolling through every one in between. */}
            <div className="flex flex-none flex-col items-center gap-[16px]">
              {ORDER.map((key, i) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => jumpTo(i)}
                  aria-label={copy.features.items[key].title}
                  aria-current={i === active}
                  className="flex h-[18px] w-[18px] items-center justify-center"
                >
                  <span
                    className="rounded-full transition-all duration-300"
                    style={{
                      background: i === active ? brand : "var(--border)",
                      width: i === active ? 10 : 7,
                      height: i === active ? 10 : 7,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / tablet fallback: stacked reveal cards */}
      <div className="flex flex-col gap-[36px] px-5 lg:hidden">
        {ORDER.map((key) => {
          const item = copy.features.items[key];
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col gap-[16px]"
            >
              <div>
                <h3 className="m-0 mb-[6px] text-[17px] font-bold tracking-[-0.01em] text-[var(--text)]">{item.title}</h3>
                <p className="m-0 text-[13.5px] leading-[1.6] text-[var(--muted)]">{item.body}</p>
              </div>
              <div className="h-[220px]">
                <FeatureVisual feature={key} brand={brand} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
