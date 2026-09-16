"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Icon } from "@/components/icons";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { ContactForm } from "@/components/landing/contact-form";
import { CountUp } from "@/components/landing/count-up";
import { TiltCard } from "@/components/landing/tilt-card";
import { LANDING_STATS, type LandingCopy, type RoleKey } from "@/lib/landing-copy";

const ROLE_ORDER: RoleKey[] = ["admin", "head", "assistant", "registration", "finance", "hr"];
const ROLE_ICON: Record<RoleKey, "shield" | "user-check" | "grad" | "user-plus" | "wallet" | "users"> = {
  admin: "shield",
  head: "user-check",
  assistant: "grad",
  registration: "user-plus",
  finance: "wallet",
  hr: "users",
};

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

// `margin` shrinks the viewport IntersectionObserver checks against — the
// default "-60px" is plenty for sections that sit thousands of pixels down
// the page (Roles/Stats/Contact), but the Hero is short enough on common
// laptop-height screens (~900px) that the Features heading right below it
// already sits inside a -60px-shrunk viewport at scroll position 0. That
// made whileInView fire on mount instead of on an actual scroll — the
// fade-up played out before the reader had scrolled far enough to see it,
// looking like it was "just there" with no transition. A much larger margin
// for that one Reveal defers the trigger until the reader has genuinely
// scrolled past the hero. Two values, not one: rootMargin applies a bare
// value to all four sides, and -260px on the left/right too collapses the
// observed region to negative width on any viewport under ~520px wide —
// the element could then never register as "in view" at all, leaving it
// permanently invisible on phones (invisible, not just un-animated, since
// the initial state is opacity 0). "-260px 0px" keeps this vertical-only.
function Reveal({ children, className, delay = 0, margin = "-60px" }: { children: React.ReactNode; className?: string; delay?: number; margin?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin }}
      variants={fadeUp}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage({
  copy,
  brand,
  brandName,
  logoUrl,
  altHref,
}: {
  copy: LandingCopy;
  brand: string;
  brandName: string;
  logoUrl: string | null;
  altHref: string;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const logoLetter = (brandName.trim()[0] ?? "Z").toUpperCase();
  const brandVars = {
    "--brand": brand,
    "--brandfg": "#ffffff",
    "--brands": `color-mix(in srgb, ${brand} 9%, var(--surface))`,
  } as React.CSSProperties;

  const navLinks: { href: string; label: string }[] = [
    { href: "#features", label: copy.nav.features },
    { href: "#roles", label: copy.nav.roles },
    { href: "#stats", label: copy.nav.stats },
    { href: "#contact", label: copy.nav.contact },
  ];

  return (
    <div dir={copy.dir} className="relative min-h-screen w-full overflow-x-clip bg-[var(--bg)]" style={brandVars}>
      {/* Quick nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-[64px] max-w-[1180px] items-center gap-4 px-5">
          <a href="#top" className="flex items-center gap-[10px]">
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center overflow-hidden rounded-[10px] bg-[var(--brand)] text-[15px] font-bold text-[var(--brandfg)]">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                logoLetter
              )}
            </div>
            <span className="text-[16px] font-bold tracking-[-0.01em] text-[var(--text)]">{brandName}</span>
          </a>
          <nav className="ms-auto hidden items-center gap-[26px] md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-[13.5px] font-medium text-[var(--muted)] hover:text-[var(--text)]">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-[10px] md:ms-0">
            <Link
              href="/login"
              className="hidden h-[38px] flex-none items-center rounded-[9px] border px-[16px] text-[13px] font-semibold sm:flex"
              style={{ borderColor: brand, color: brand, background: "var(--brands)" }}
            >
              {copy.nav.signIn}
            </Link>
            <Link
              href={altHref}
              className="hidden h-[38px] flex-none items-center rounded-[9px] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--text)] lg:flex"
            >
              {copy.locale === "en" ? "العربية" : "English"}
            </Link>
            <button onClick={() => setNavOpen((v) => !v)} className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[9px] border border-[var(--border)] md:hidden">
              <Icon name={navOpen ? "x" : "menu"} size={17} />
            </button>
          </div>
        </div>
        {navOpen && (
          <div className="flex flex-col gap-[2px] border-t border-[var(--border)] bg-[var(--bg)] p-3 md:hidden">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setNavOpen(false)} className="rounded-[8px] px-3 py-[10px] text-[14px] font-medium text-[var(--text)] hover:bg-[var(--surface2)]">
                {l.label}
              </a>
            ))}
            <Link
              href="/login"
              className="rounded-[8px] px-3 py-[10px] text-[14px] font-semibold"
              style={{ color: brand, background: "var(--brands)" }}
            >
              {copy.nav.signIn}
            </Link>
            <Link href={altHref} className="rounded-[8px] px-3 py-[10px] text-[14px] font-medium text-[var(--muted)]">
              {copy.locale === "en" ? "العربية" : "English"}
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden px-5 pb-[90px] pt-[86px] sm:pb-[120px] sm:pt-[120px]">
        <div
          className="pointer-events-none absolute inset-0 animate-[heroGridDrift_16s_linear_infinite] opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in srgb, var(--text) 6%, transparent) 1px, transparent 1.4px) 0 0/26px 26px",
          }}
        />
        {/* Three independently-drifting blurred blobs (brand + two
            complementary hues) instead of one static one — slow, subtle,
            transform-only motion so the hero doesn't read as a flat, static
            slab while staying calm enough for a B2B tool, not a game. */}
        <div
          className="pointer-events-none absolute -top-[220px] left-1/2 h-[520px] w-[720px] animate-[heroBlobFloatA_15s_ease-in-out_infinite] rounded-full opacity-[0.16] blur-[60px]"
          style={{ background: `radial-gradient(circle, ${brand} 0%, transparent 70%)` }}
        />
        <div
          className="pointer-events-none absolute top-[60px] right-[6%] h-[340px] w-[340px] animate-[heroBlobFloatB_12s_ease-in-out_infinite] rounded-full opacity-[0.13] blur-[70px]"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute bottom-[-80px] left-[8%] h-[300px] w-[300px] animate-[heroBlobFloatC_18s_ease-in-out_infinite] rounded-full opacity-[0.12] blur-[65px]"
          style={{ background: `radial-gradient(circle, ${brand} 0%, transparent 70%)` }}
        />
        <div className="relative mx-auto flex max-w-[760px] flex-col items-center text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-[18px] inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-[14px] py-[6px] text-[12px] font-semibold text-[var(--muted)]"
          >
            {copy.hero.eyebrow}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="m-0 mb-[18px] text-[36px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--text)] sm:text-[52px]"
          >
            {copy.hero.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="m-0 mb-[34px] max-w-[520px] text-[16px] leading-[1.6] text-[var(--muted)] sm:text-[18px]"
          >
            {copy.hero.subtitle}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="flex flex-wrap items-center justify-center gap-[12px]"
          >
            <a
              href="#contact"
              className="flex h-[50px] items-center gap-[8px] rounded-[12px] px-[26px] text-[15px] font-semibold text-[var(--brandfg)] shadow-[0_10px_26px_-8px_var(--brand)]"
              style={{ background: brand }}
            >
              {copy.hero.cta}
              <Icon name="arrow-r" size={16} className={copy.dir === "rtl" ? "rotate-180" : ""} />
            </a>
            <Link
              href="/login"
              className="flex h-[50px] items-center rounded-[12px] border-2 px-[26px] text-[15px] font-semibold"
              style={{ borderColor: brand, color: brand, background: "var(--brands)" }}
            >
              {copy.hero.secondaryCta}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-[70px] sm:py-[90px]">
        <Reveal className="mx-auto mb-[50px] max-w-[640px] px-5 text-center" margin="-260px 0px">
          <span className="mb-[10px] inline-block text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: brand }}>
            {copy.features.eyebrow}
          </span>
          <h2 className="m-0 mb-[12px] text-[28px] font-bold tracking-[-0.02em] text-[var(--text)] sm:text-[36px]">{copy.features.title}</h2>
          <p className="m-0 text-[15px] leading-[1.6] text-[var(--muted)]">{copy.features.subtitle}</p>
        </Reveal>
        <FeatureShowcase copy={copy} brand={brand} />
      </section>

      {/* Roles */}
      <section id="roles" className="relative bg-[var(--surface2)] px-5 py-[70px] sm:py-[90px]">
        <Reveal className="mx-auto mb-[50px] max-w-[640px] text-center">
          <span className="mb-[10px] inline-block text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: brand }}>
            {copy.roles.eyebrow}
          </span>
          <h2 className="m-0 mb-[12px] text-[28px] font-bold tracking-[-0.02em] text-[var(--text)] sm:text-[36px]">{copy.roles.title}</h2>
          <p className="m-0 text-[15px] leading-[1.6] text-[var(--muted)]">{copy.roles.subtitle}</p>
        </Reveal>
        <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_ORDER.map((key, i) => {
            const item = copy.roles.items[key];
            return (
              <Reveal key={key} delay={i * 0.06}>
                <TiltCard className="h-full rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-[0_1px_2px_rgba(16,23,41,0.04)]">
                  <div
                    className="mb-[14px] flex h-[42px] w-[42px] items-center justify-center rounded-[11px]"
                    style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)`, color: brand }}
                  >
                    <Icon name={ROLE_ICON[key]} size={19} />
                  </div>
                  <h3 className="m-0 mb-[8px] text-[17px] font-bold tracking-[-0.01em] text-[var(--text)]">{item.title}</h3>
                  <p className="m-0 text-[13.5px] leading-[1.6] text-[var(--muted)]">{item.body}</p>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="relative px-5 py-[70px] sm:py-[90px]">
        <Reveal className="mx-auto mb-[46px] max-w-[640px] text-center">
          <span className="mb-[10px] inline-block text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: brand }}>
            {copy.stats.eyebrow}
          </span>
          <h2 className="m-0 text-[28px] font-bold tracking-[-0.02em] text-[var(--text)] sm:text-[36px]">{copy.stats.title}</h2>
        </Reveal>
        <div className="mx-auto grid max-w-[900px] grid-cols-2 gap-[18px] sm:grid-cols-4">
          {LANDING_STATS.map((s, i) => (
            <Reveal key={s.key} delay={i * 0.06} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[22px] text-center">
              <div className="text-[30px] font-bold tracking-[-0.02em] sm:text-[38px]" style={{ color: brand }}>
                <CountUp value={s.value} />
              </div>
              <div className="mt-[6px] text-[12.5px] font-medium text-[var(--muted)]">{copy.stats.labels[s.key]}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative bg-[var(--surface2)] px-5 py-[70px] sm:py-[90px]">
        <div className="mx-auto grid max-w-[980px] grid-cols-1 gap-[46px] lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <span className="mb-[10px] inline-block text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: brand }}>
              {copy.contact.eyebrow}
            </span>
            <h2 className="m-0 mb-[14px] text-[28px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--text)] sm:text-[34px]">
              {copy.contact.title}
            </h2>
            <p className="m-0 text-[15px] leading-[1.6] text-[var(--muted)]">{copy.contact.subtitle}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <ContactForm copy={copy} brand={brand} />
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-5 py-[26px]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3">
          <span className="text-[12.5px] text-[var(--subtle)]">
            © {new Date().getFullYear()} {brandName}. {copy.footer.rights}
          </span>
          <Link href="/login" className="text-[12.5px] font-semibold text-[var(--brand)]">
            {copy.footer.signIn}
          </Link>
        </div>
      </footer>
    </div>
  );
}
