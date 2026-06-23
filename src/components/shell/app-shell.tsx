"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import type { NavItem } from "@/lib/roles";

type NavMode = "sidebar" | "rail";

function useActiveKey() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  return segments[0] || "dashboard";
}

function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  });

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("radams-theme", next);
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface2)] ${className ?? ""}`}
    >
      <Icon name={theme === "dark" ? "moon" : "sun"} size={16} />
      {theme === "dark" ? "Dark mode" : "Light mode"}
    </button>
  );
}

function UserMenu({ person }: { person: { name: string; label: string; initials: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[9px] rounded-[10px] pl-[14px] border-l border-[var(--border)] py-1"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-[13px] font-bold text-[var(--brandfg)]">
          {person.initials}
        </div>
        <div className="hidden text-left leading-[1.2] sm:block">
          <div className="text-[13px] font-semibold text-[var(--text)]">{person.name}</div>
          <div className="text-[11.5px] text-[var(--muted)]">{person.label}</div>
        </div>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] p-[6px] shadow-[var(--shadow)]">
          <div className="px-3 py-2">
            <div className="text-[13px] font-semibold text-[var(--text)]">{person.name}</div>
            <div className="text-[11.5px] text-[var(--muted)]">{person.label}</div>
          </div>
          <div className="my-1 h-px bg-[var(--border)]" />
          <ThemeToggle className="w-full" />
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--surface2)]"
          >
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  navItems,
  person,
  brandName,
  logoLetter,
  orgName,
  children,
}: {
  navItems: NavItem[];
  person: { name: string; label: string; initials: string };
  brandName: string;
  logoLetter: string;
  orgName: string | null;
  children: React.ReactNode;
}) {
  const activeKey = useActiveKey();
  const [navMode, setNavMode] = useState<NavMode>(() => {
    if (typeof localStorage === "undefined") return "sidebar";
    const saved = localStorage.getItem("radams-nav");
    return saved === "rail" ? "rail" : "sidebar";
  });
  const [moreOpen, setMoreOpen] = useState(false);

  function toggleNav() {
    const next = navMode === "rail" ? "sidebar" : "rail";
    setNavMode(next);
    localStorage.setItem("radams-nav", next);
  }

  const active = navItems.find((n) => n.key === activeKey);
  const pageTitle = active?.label ?? "Dashboard";
  const isRail = navMode === "rail";
  const navPrimary = navItems.slice(0, 4);
  const moreItems = navItems.slice(4);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg)]">
      {/* DESKTOP SIDEBAR */}
      <aside
        className="hidden flex-none flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] p-[13px] transition-[width] duration-150 md:flex"
        style={{ width: isRail ? "74px" : "248px" }}
      >
        <div className="flex min-h-[44px] items-center gap-[6px] pb-[14px]">
          <button
            onClick={toggleNav}
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
          >
            <Icon name="menu" size={21} />
          </button>
          <div className={`flex min-w-0 flex-1 items-center gap-[9px] overflow-hidden ${isRail ? "opacity-0" : "opacity-100"}`}>
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[var(--brand)] text-[16px] font-bold text-[var(--brandfg)]">
              {logoLetter}
            </div>
            <div className="min-w-0 leading-[1.1] whitespace-nowrap">
              <div className="text-[15px] font-bold tracking-[-0.01em] text-[var(--text)]">{brandName}</div>
              <div className="overflow-hidden text-ellipsis text-[11px] font-medium text-[var(--subtle)]">{orgName ?? "RadAMS Platform"}</div>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-[3px]">
          {navItems.map((n) => {
            const isActive = n.key === activeKey;
            return (
              <Link
                key={n.key}
                href={`/${n.key}`}
                title={n.label}
                className="flex items-center gap-3 overflow-hidden rounded-[9px] px-[9px] py-[10px] text-[13.5px] hover:bg-[var(--surface2)]"
                style={{
                  color: isActive ? "var(--brand)" : "var(--muted)",
                  background: isActive ? "var(--brands)" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <span className="flex h-5 w-5 flex-none items-center justify-center">
                  <Icon name={n.icon} size={20} />
                </span>
                <span className={`min-w-0 flex-1 whitespace-nowrap ${isRail ? "opacity-0" : "opacity-100"}`}>{n.label}</span>
                {!!n.badge && (
                  <span
                    className={`flex h-[19px] min-w-[19px] flex-none items-center justify-center rounded-full bg-[var(--brand)] px-[5px] text-[11px] font-bold text-[var(--brandfg)] ${isRail ? "opacity-0" : "opacity-100"}`}
                  >
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-[11px] overflow-hidden rounded-[10px] bg-[var(--surface2)] p-[9px]">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--brand)] text-[13px] font-bold text-[var(--brandfg)]">
            {person.initials}
          </div>
          <div className={`min-w-0 flex-1 whitespace-nowrap leading-[1.2] ${isRail ? "opacity-0" : "opacity-100"}`}>
            <div className="overflow-hidden text-ellipsis text-[13px] font-semibold text-[var(--text)]">{person.name}</div>
            <div className="text-[11.5px] text-[var(--muted)]">{person.label}</div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* DESKTOP HEADER STRIP */}
        <header className="hidden h-[62px] flex-none items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 md:flex">
          <div className="flex h-10 w-[320px] max-w-[42%] cursor-default items-center gap-[9px] rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] px-[13px]">
            <Icon name="search" size={17} className="text-[var(--subtle)]" />
            <span className="text-[13.5px] text-[var(--subtle)]">Search students, assistants, courses…</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)]">
              <Icon name="bell" size={19} />
            </button>
            <UserMenu person={person} />
          </div>
        </header>

        {/* MOBILE APP BAR */}
        <header className="flex h-14 flex-none items-center gap-[11px] border-b border-[var(--border)] bg-[var(--surface)] px-4 md:hidden">
          <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[var(--brand)] text-[15px] font-bold text-[var(--brandfg)]">
            {logoLetter}
          </div>
          <span className="text-[16px] font-bold tracking-[-0.01em] text-[var(--text)]">{pageTitle}</span>
          <div className="ml-auto flex items-center gap-1">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-[9px] text-[var(--muted)]">
              <Icon name="bell" size={19} />
              <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-[var(--surface)] bg-[var(--danger)]" />
            </button>
            <UserMenu person={person} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-[26px]">
          <div className="pb-[80px] md:pb-0">{children}</div>
        </main>

        {/* MOBILE BOTTOM NAV */}
        <nav className="flex h-16 flex-none items-stretch border-t border-[var(--border)] bg-[var(--surface)] px-1 md:hidden">
          {navPrimary.map((n) => {
            const isActive = n.key === activeKey;
            return (
              <Link
                key={n.key}
                href={`/${n.key}`}
                className="relative flex flex-1 flex-col items-center justify-center gap-[3px]"
                style={{ color: isActive ? "var(--brand)" : "var(--muted)" }}
              >
                <Icon name={n.icon} size={21} />
                <span className="whitespace-nowrap text-[9.5px] font-semibold">{n.label}</span>
                {isActive && (
                  <span className="absolute left-1/2 top-0 h-[3px] w-[22px] -translate-x-1/2 rounded-b-[3px] bg-[var(--brand)]" />
                )}
              </Link>
            );
          })}
          {moreItems.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="relative flex flex-1 flex-col items-center justify-center gap-[3px]"
              style={{ color: moreItems.some((n) => n.key === activeKey) ? "var(--brand)" : "var(--subtle)" }}
            >
              <Icon name="menu" size={21} />
              <span className="text-[9.5px] font-semibold">More</span>
            </button>
          )}
        </nav>
      </div>

      {/* MOBILE MORE SHEET */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-[rgba(8,12,22,0.4)] md:hidden" onClick={() => setMoreOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[18px] border-t border-[var(--border)] bg-[var(--surface)] p-[8px_14px_22px] shadow-[0_-8px_30px_rgba(8,12,22,.18)] md:hidden">
            <div className="mx-auto mb-[14px] mt-2 h-1 w-9 rounded-full bg-[var(--border)]" />
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((n) => {
                const isActive = n.key === activeKey;
                return (
                  <Link
                    key={n.key}
                    href={`/${n.key}`}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center justify-center gap-[7px] rounded-[12px] border p-[14px_6px]"
                    style={{
                      color: isActive ? "var(--brand)" : "var(--muted)",
                      background: isActive ? "var(--brands)" : "var(--surface2)",
                      borderColor: isActive ? "var(--brand)" : "var(--border)",
                    }}
                  >
                    <Icon name={n.icon} size={22} />
                    <span className="text-center text-[11px] font-semibold leading-[1.2]">{n.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
