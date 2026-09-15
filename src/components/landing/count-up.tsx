"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

// Animates the numeric portion of a stat string (e.g. "5,500+") counting up
// from 0 once it scrolls into view, keeping any non-numeric suffix ("+")
// static so it doesn't flicker mid-count.
export function CountUp({ value, durationMs = 1200 }: { value: string; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const numeric = parseInt(value.replace(/[^\d]/g, ""), 10) || 0;
  const suffix = value.replace(/^[\d,]+/, "");
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(numeric * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, numeric, durationMs]);

  return (
    <span ref={ref}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
