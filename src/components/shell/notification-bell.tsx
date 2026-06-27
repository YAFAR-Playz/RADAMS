"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import { toneColors } from "@/lib/tone";
import { getNotifications, type NotificationItem } from "@/lib/actions/notifications";

const POLL_MS = 60_000;
const DISMISSED_KEY = "radams-dismissed-notifications";

function loadDismissed(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getNotifications();
        if (cancelled) return;
        setItems(data);
        const liveIds = new Set(data.map((n) => n.id));
        setDismissed((prev) => {
          const next = new Set([...prev].filter((id) => liveIds.has(id)));
          localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
          return next;
        });
      } catch {
        if (!cancelled) setItems([]);
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const visibleItems = (items ?? []).filter((n) => !dismissed.has(n.id));
  const count = items === null ? 0 : visibleItems.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 flex-none items-center justify-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface2)] md:h-10 md:w-10 md:rounded-[10px] md:border md:border-[var(--border)] md:bg-[var(--surface)]"
      >
        <Icon name="bell" size={19} />
        {count > 0 && (
          <span className="absolute right-[6px] top-[6px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-[1.5px] border-[var(--surface)] bg-[var(--danger)] px-[3px] text-[9px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[420px] w-[320px] overflow-y-auto rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <div className="border-b border-[var(--border2)] p-[12px_14px] text-[13px] font-semibold text-[var(--text)]">Notifications</div>
          {items === null ? (
            <div className="flex flex-col gap-2 p-[10px]">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonRow key={i} className="h-[52px]" />
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="p-[26px] text-center text-[12.5px] text-[var(--muted)]">You&apos;re all caught up.</div>
          ) : (
            <div className="p-[6px]">
              {visibleItems.map((n) => {
                const { bg, fg } = toneColors(n.tone);
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => {
                      dismiss(n.id);
                      setOpen(false);
                    }}
                    className="flex items-start gap-[10px] rounded-[8px] p-[9px_10px] hover:bg-[var(--surface2)]"
                  >
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px]" style={{ background: bg, color: fg }}>
                      <Icon name={n.icon} size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold leading-[1.3] text-[var(--text)]">{n.title}</div>
                      <div className="mt-[1px] truncate text-[11.5px] text-[var(--subtle)]">{n.detail}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
