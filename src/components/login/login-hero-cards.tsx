"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";

type Scene = {
  stat: { icon: IconName; title: string; subtitle: string; value: string; pillLabel: string; pillTone: "success" | "brand" };
  bars: { icon: IconName; title: string; subtitle: string; values: number[] };
  people: { icon: IconName; title: string; subtitle: string; extra: string };
};

const SCENES: Scene[] = [
  {
    stat: { icon: "wallet", title: "July payroll", subtitle: "42 staff · on time", value: "$18,240", pillLabel: "Released", pillTone: "success" },
    bars: { icon: "chart", title: "Attendance", subtitle: "this month", values: [40, 68, 52, 85, 62] },
    people: { icon: "users", title: "12 assistants", subtitle: "auto-assigned today", extra: "+9" },
  },
  {
    stat: { icon: "book", title: "Evaluations", subtitle: "avg. this term", value: "97%", pillLabel: "On track", pillTone: "brand" },
    bars: { icon: "trend", title: "Enrollment", subtitle: "last 6 weeks", values: [30, 45, 55, 60, 78, 90] },
    people: { icon: "grad", title: "3 new hires", subtitle: "onboarded this week", extra: "+2" },
  },
  {
    stat: { icon: "clock", title: "Sessions logged", subtitle: "this week", value: "156", pillLabel: "Up 12%", pillTone: "brand" },
    bars: { icon: "target", title: "Course progress", subtitle: "avg. completion", values: [55, 70, 64, 80, 72] },
    people: { icon: "shield", title: "5 admins", subtitle: "reviewing payroll", extra: "+1" },
  },
];

const CYCLE_MS = 4500;
const FADE_MS = 350;

export function LoginHeroCards({ brand }: { brand: string }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Randomizing the start scene must happen post-hydration (server always renders scene 0).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(Math.floor(Math.random() * SCENES.length));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % SCENES.length);
        setVisible(true);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => clearInterval(cycle);
  }, []);

  const scene = SCENES[index];
  const fade = {
    transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(6px)",
  } as const;

  return (
    <div className="relative my-10 flex-1">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.14] blur-[30px]"
        style={{ background: `radial-gradient(circle, ${brand} 0%, transparent 70%)` }}
      />

      {/* Stat card */}
      <div
        className="absolute left-[6%] top-[8%] w-[240px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[18px] shadow-[0_18px_36px_rgba(16,23,41,0.12)]"
        style={{ transform: "rotate(-6deg)" }}
      >
        <div style={fade}>
          <div className="flex items-center gap-[9px]">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[var(--brands)] text-[var(--brand)]">
              <Icon name={scene.stat.icon} size={16} />
            </div>
            <div>
              <p className="m-0 text-[13px] font-semibold text-[var(--text)]">{scene.stat.title}</p>
              <p className="m-0 text-[11.5px] text-[var(--subtle)]">{scene.stat.subtitle}</p>
            </div>
          </div>
          <div className="mt-[14px] flex items-center justify-between rounded-[10px] bg-[var(--surface2)] px-3 py-[9px]">
            <span className="text-[15px] font-bold tracking-[-0.01em] text-[var(--text)]">{scene.stat.value}</span>
            <span
              className="rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold"
              style={
                scene.stat.pillTone === "success"
                  ? { background: "color-mix(in srgb, #16a34a 16%, transparent)", color: "#15803d" }
                  : { background: `color-mix(in srgb, ${brand} 16%, transparent)`, color: brand }
              }
            >
              {scene.stat.pillLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Bars card */}
      <div
        className="absolute right-[2%] top-[30%] w-[210px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[18px] shadow-[0_18px_36px_rgba(16,23,41,0.12)]"
        style={{ transform: "rotate(4deg)" }}
      >
        <div style={fade}>
          <div className="flex items-center gap-[9px]">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[var(--brands)] text-[var(--brand)]">
              <Icon name={scene.bars.icon} size={16} />
            </div>
            <div>
              <p className="m-0 text-[13px] font-semibold text-[var(--text)]">{scene.bars.title}</p>
              <p className="m-0 text-[11.5px] text-[var(--subtle)]">{scene.bars.subtitle}</p>
            </div>
          </div>
          <div className="mt-[16px] flex h-[46px] items-end gap-[6px]">
            {scene.bars.values.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[3px] transition-[height] duration-500"
                style={{
                  height: `${h}%`,
                  background: i === scene.bars.values.length - 1 ? "var(--brand)" : "color-mix(in srgb, var(--brand) 30%, transparent)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* People card */}
      <div
        className="absolute bottom-[6%] left-[16%] w-[220px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[18px] shadow-[0_18px_36px_rgba(16,23,41,0.12)]"
        style={{ transform: "rotate(-3deg)" }}
      >
        <div style={fade}>
          <div className="flex items-center gap-[9px]">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[var(--brands)] text-[var(--brand)]">
              <Icon name={scene.people.icon} size={16} />
            </div>
            <div>
              <p className="m-0 text-[13px] font-semibold text-[var(--text)]">{scene.people.title}</p>
              <p className="m-0 text-[11.5px] text-[var(--subtle)]">{scene.people.subtitle}</p>
            </div>
          </div>
          <div className="mt-[14px] flex">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] text-[10px] font-bold text-[var(--brandfg)]"
                style={{
                  marginLeft: i === 0 ? 0 : -8,
                  background: `color-mix(in srgb, var(--brand) ${70 - i * 12}%, var(--subtle))`,
                  zIndex: 4 - i,
                }}
              >
                {i === 3 ? scene.people.extra : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
