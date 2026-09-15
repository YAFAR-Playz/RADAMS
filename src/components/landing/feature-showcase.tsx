"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { FeatureVisual } from "@/components/landing/feature-visuals";
import { TiltCard } from "@/components/landing/tilt-card";
import type { FeatureKey, LandingCopy } from "@/lib/landing-copy";

const ORDER: FeatureKey[] = ["attendance", "assignments", "payroll", "weakTopics", "messaging", "reports"];

// Desktop: a pinned/sticky scroll-driven showcase — the visual on the right
// stays fixed in the viewport while the feature list on the left scrolls
// past it, with the active item (and its visual) advancing based on scroll
// position within this section. Mobile falls back to a plain stacked grid
// below — a 500vh scroll-jacked two-column layout doesn't translate to a
// narrow screen, so it isn't worth forcing.
export function FeatureShowcase({ copy, brand }: { copy: LandingCopy; brand: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(ORDER.length - 1, Math.floor(v * ORDER.length));
    setActive(idx);
  });

  return (
    <>
      {/* Desktop pinned showcase */}
      <div ref={containerRef} className="relative hidden lg:block" style={{ height: `${ORDER.length * 85}vh` }}>
        {/* top-[64px]/h-[calc(100vh-64px)] (not top-0/h-screen) so this sticks
            just below the sticky header instead of underneath it — otherwise
            the header's own sticky layer covers whatever centers near the
            top of this box, clipping the first item behind it. */}
        <div className="sticky top-[64px] flex h-[calc(100vh-64px)] items-center overflow-hidden">
          <div className="mx-auto grid w-full max-w-[1080px] grid-cols-2 items-center gap-[56px] px-10">
            <div className="flex flex-col gap-[6px]">
              {ORDER.map((key, i) => {
                const item = copy.features.items[key];
                const isActive = i === active;
                return (
                  <div
                    key={key}
                    className="rounded-[16px] p-[18px] transition-colors duration-300"
                    style={{ background: isActive ? "var(--brands)" : "transparent" }}
                  >
                    <h3
                      className="m-0 mb-[6px] text-[19px] font-bold tracking-[-0.01em] transition-colors duration-300"
                      style={{ color: isActive ? brand : "var(--text)" }}
                    >
                      {item.title}
                    </h3>
                    <p
                      className="m-0 max-w-[380px] text-[13.5px] leading-[1.6] transition-opacity duration-300"
                      style={{ color: "var(--muted)", opacity: isActive ? 1 : 0.55 }}
                    >
                      {item.body}
                    </p>
                  </div>
                );
              })}
            </div>
            {/* All 6 visuals stay mounted, stacked, and crossfade by opacity
                rather than an AnimatePresence mount/unmount swap — that swap
                queues exit-then-enter per key change (mode="wait"), which
                falls behind and looks broken under rapid/bidirectional
                scroll-scrubbing where `active` can flip several times before
                a single transition finishes. Independent per-layer opacity
                has no such queue: each layer just animates to its own target
                whenever `active` changes, in either direction. */}
            <div className="relative h-[300px]">
              {ORDER.map((key, i) => (
                <motion.div
                  key={key}
                  animate={{ opacity: i === active ? 1 : 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="absolute inset-0"
                  style={{ pointerEvents: i === active ? "auto" : "none" }}
                >
                  <TiltCard className="h-full w-full [transform-style:preserve-3d]">
                    <FeatureVisual feature={key} brand={brand} />
                  </TiltCard>
                </motion.div>
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
              <div className="h-[220px]">
                <FeatureVisual feature={key} brand={brand} />
              </div>
              <div>
                <h3 className="m-0 mb-[6px] text-[17px] font-bold tracking-[-0.01em] text-[var(--text)]">{item.title}</h3>
                <p className="m-0 text-[13.5px] leading-[1.6] text-[var(--muted)]">{item.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
