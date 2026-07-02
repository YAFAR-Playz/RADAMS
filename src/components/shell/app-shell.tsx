"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import type { NavItem } from "@/lib/roles";
import { NotificationBell } from "@/components/shell/notification-bell";
import { globalSearch, type SearchResult } from "@/lib/actions/global-search";
import { setSearchHandoff } from "@/lib/search-handoff";

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

function PersonAvatar({ person, size }: { person: { initials: string; avatarUrl: string | null }; size: number }) {
  if (person.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatarUrl}
        alt=""
        className="flex-none rounded-full bg-[var(--brand)] object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-[var(--brand)] font-bold text-[var(--brandfg)]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {person.initials}
    </div>
  );
}

function UserMenu({ person }: { person: { name: string; label: string; initials: string; avatarUrl: string | null } }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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
    setSigningOut(true);
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
        <PersonAvatar person={person} size={36} />
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
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface2)]"
          >
            <Icon name="settings" size={16} />
            Settings
          </Link>
          <ThemeToggle className="w-full" />
          <button
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--surface2)] disabled:opacity-60"
          >
            {signingOut ? <Spinner size={16} /> : <Icon name="logout" size={16} />}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function BrandHeader({ brandName, orgName }: { brandName: string; orgName: string | null }) {
  if (orgName) {
    return <div className="truncate text-[15px] font-bold tracking-[-0.01em] text-[var(--text)]">{orgName}</div>;
  }
  return (
    <>
      <div className="truncate text-[15px] font-bold tracking-[-0.01em] text-[var(--text)]">{brandName}</div>
      <div className="truncate text-[11px] font-medium text-[var(--subtle)]">ZAD-AMS Platform</div>
    </>
  );
}

function LogoMark({ logoUrl, logoLetter, size }: { logoUrl: string | null; logoLetter: string; size: number }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="flex-none rounded-[9px] bg-[var(--brand)] object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-[9px] bg-[var(--brand)] font-bold text-[var(--brandfg)]"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {logoLetter}
    </div>
  );
}

const KIND_ICON = { student: "grad", staff: "users", course: "book" } as const;

function HeaderSearch() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      (() => {
        setResults([]);
        setLoading(false);
      })();
      return;
    }
    (() => setLoading(true))();
    const timer = setTimeout(() => {
      globalSearch(q)
        .then((r) => setResults(r))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function onSelect(r: SearchResult) {
    setSearchHandoff(r.label);
    setQuery("");
    setResults([]);
    setOpen(false);
    router.push(r.href);
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex h-10 w-[320px] max-w-[42%] items-center gap-[9px] rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] px-[13px] focus-within:border-[var(--brand)]">
        <Icon name="search" size={17} className="flex-none text-[var(--subtle)]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search students, assistants, courses…"
          className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none placeholder:text-[var(--subtle)]"
        />
        {loading && <Spinner size={14} className="flex-none text-[var(--subtle)]" />}
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[360px] max-h-[360px] overflow-y-auto rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] p-[6px] shadow-[var(--shadow)]">
          {loading && results.length === 0 ? (
            <div className="p-[14px] text-center text-[12.5px] text-[var(--subtle)]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-[14px] text-center text-[12.5px] text-[var(--subtle)]">No matches for &quot;{query}&quot;.</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => onSelect(r)}
                className="flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] text-left hover:bg-[var(--surface2)]"
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[var(--brands)] text-[var(--brand)]">
                  <Icon name={KIND_ICON[r.kind]} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[var(--text)]">{r.label}</div>
                  <div className="truncate text-[11.5px] text-[var(--subtle)]">{r.subtitle}</div>
                </span>
              </button>
            ))
          )}
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
  logoUrl,
  orgName,
  children,
}: {
  navItems: NavItem[];
  person: { name: string; label: string; initials: string; avatarUrl: string | null };
  brandName: string;
  logoLetter: string;
  logoUrl: string | null;
  orgName: string | null;
  children: React.ReactNode;
}) {
  const activeKey = useActiveKey();
  const [navMode, setNavMode] = useState<NavMode>(() => {
    if (typeof localStorage === "undefined") return "sidebar";
    const saved = localStorage.getItem("radams-nav");
    return saved === "rail" ? "rail" : "sidebar";
  });
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);

  function openMobileMenu() {
    setMobileMenuMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMobileMenuVisible(true)));
  }

  function closeMobileMenu() {
    setMobileMenuVisible(false);
    setTimeout(() => setMobileMenuMounted(false), 200);
  }

  function toggleNav() {
    const next = navMode === "rail" ? "sidebar" : "rail";
    setNavMode(next);
    localStorage.setItem("radams-nav", next);
  }

  const active = navItems.find((n) => n.key === activeKey);
  const pageTitle = active?.label ?? "Dashboard";
  const isRail = navMode === "rail";

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
            <LogoMark logoUrl={logoUrl} logoLetter={logoLetter} size={32} />
            <div className="min-w-0 leading-[1.1] whitespace-nowrap">
              <BrandHeader brandName={brandName} orgName={orgName} />
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
          <PersonAvatar person={person} size={34} />
          <div className={`min-w-0 flex-1 whitespace-nowrap leading-[1.2] ${isRail ? "opacity-0" : "opacity-100"}`}>
            <div className="overflow-hidden text-ellipsis text-[13px] font-semibold text-[var(--text)]">{person.name}</div>
            <div className="text-[11.5px] text-[var(--muted)]">{person.label}</div>
          </div>
          <Link
            href="/settings"
            title="Settings"
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] ${isRail ? "opacity-0" : "opacity-100"}`}
          >
            <Icon name="settings" size={16} />
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* DESKTOP HEADER STRIP */}
        <header className="hidden h-[62px] flex-none items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 md:flex">
          <HeaderSearch />
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <UserMenu person={person} />
          </div>
        </header>

        {/* MOBILE APP BAR */}
        <header className="flex h-14 flex-none items-center gap-[11px] border-b border-[var(--border)] bg-[var(--surface)] px-4 md:hidden">
          <button
            onClick={openMobileMenu}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
          >
            <Icon name="menu" size={22} />
          </button>
          <LogoMark logoUrl={logoUrl} logoLetter={logoLetter} size={30} />
          <span className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-[-0.01em] text-[var(--text)]">{pageTitle}</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <UserMenu person={person} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-[26px]">{children}</main>
      </div>

      {/* MOBILE FULL-SCREEN MENU */}
      {mobileMenuMounted && (
        <div
          className={`fixed inset-0 z-50 flex flex-col bg-[var(--surface)] transition-opacity duration-200 md:hidden ${mobileMenuVisible ? "opacity-100" : "opacity-0"}`}
        >
          <div
            className={`flex h-14 flex-none items-center gap-[11px] border-b border-[var(--border)] px-4 transition-transform duration-200 ${mobileMenuVisible ? "translate-y-0" : "-translate-y-2"}`}
          >
            <button
              onClick={closeMobileMenu}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            >
              <Icon name="x" size={22} />
            </button>
            <LogoMark logoUrl={logoUrl} logoLetter={logoLetter} size={30} />
            <div className="min-w-0 leading-[1.1]">
              <BrandHeader brandName={brandName} orgName={orgName} />
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-[3px] overflow-y-auto p-[12px]">
            {navItems.map((n) => {
              const isActive = n.key === activeKey;
              return (
                <Link
                  key={n.key}
                  href={`/${n.key}`}
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 rounded-[10px] px-[13px] py-[13px] text-[15px]"
                  style={{
                    color: isActive ? "var(--brand)" : "var(--text)",
                    background: isActive ? "var(--brands)" : "transparent",
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  <span className="flex h-6 w-6 flex-none items-center justify-center">
                    <Icon name={n.icon} size={22} />
                  </span>
                  <span className="min-w-0 flex-1">{n.label}</span>
                  {!!n.badge && (
                    <span className="flex h-[20px] min-w-[20px] flex-none items-center justify-center rounded-full bg-[var(--brand)] px-[6px] text-[11px] font-bold text-[var(--brandfg)]">
                      {n.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-[11px] border-t border-[var(--border)] p-[14px]">
            <PersonAvatar person={person} size={34} />
            <div className="min-w-0 flex-1 leading-[1.2]">
              <div className="truncate text-[13px] font-semibold text-[var(--text)]">{person.name}</div>
              <div className="text-[11.5px] text-[var(--muted)]">{person.label}</div>
            </div>
            <Link
              href="/settings"
              onClick={closeMobileMenu}
              title="Settings"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            >
              <Icon name="settings" size={18} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
