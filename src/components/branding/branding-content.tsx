"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  getBranding,
  saveBranding,
  uploadOrgLogo,
  removeOrgLogo,
  getParentWhatsappLink,
  saveParentWhatsappLink,
  type BrandingDraft,
} from "@/lib/actions/branding";
import { PRIMARIES, SECONDARIES, FONTS, CORNERS, mixHex } from "@/lib/branding-options";

export function BrandingContent() {
  const [saved, setSaved] = useState<BrandingDraft | null>(null);
  const [draft, setDraft] = useState<BrandingDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const [parentLink, setParentLink] = useState("");
  const [savedParentLink, setSavedParentLink] = useState("");
  const [savingParentLink, setSavingParentLink] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [data, link] = await Promise.all([getBranding(), getParentWhatsappLink()]);
        setSaved(data);
        setDraft(data);
        setParentLink(link ?? "");
        setSavedParentLink(link ?? "");
      } catch {
        setError("Couldn't load branding settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSaveParentLink() {
    setSavingParentLink(true);
    try {
      await saveParentWhatsappLink(parentLink);
      setSavedParentLink(parentLink);
    } catch {
      setError("Couldn't save the parent WhatsApp link — try again.");
    } finally {
      setSavingParentLink(false);
    }
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await saveBranding(draft);
      setSaved(draft);
    } catch {
      setError("Couldn't save branding — try again.");
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    if (saved) setDraft(saved);
  }

  async function onLogoSelected(file: File) {
    setLogoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { url } = await uploadOrgLogo(formData);
      setDraft((d) => d && { ...d, logoUrl: url });
      setSaved((s) => s && { ...s, logoUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload this logo — try again.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function onLogoRemove() {
    setLogoUploading(true);
    setError(null);
    try {
      await removeOrgLogo();
      setDraft((d) => d && { ...d, logoUrl: null });
      setSaved((s) => s && { ...s, logoUrl: null });
    } catch {
      setError("Couldn't remove this logo — try again.");
    } finally {
      setLogoUploading(false);
    }
  }

  if (loading || !draft) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonRow className="h-[120px]" />
        <SkeletonRow className="h-[260px]" />
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const fontStack = FONTS.find((f) => f.value === draft.font)?.stack ?? FONTS[0].stack;
  const cornerRad = draft.corner === "sharp" ? "4px" : "13px";
  const cornerSm = draft.corner === "sharp" ? "3px" : "9px";
  const logoLetter = (draft.name.trim()[0] ?? "R").toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Organization branding</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Customize your organization</h1>
        <p className="m-0 mt-[3px] max-w-[560px] text-[13px] leading-[1.5] text-[var(--muted)]">
          Adjust your brand name, colors, font and shape — every screen in your organization updates automatically.
        </p>
        <div className="mt-[14px] flex items-start gap-[10px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--infos)] p-[11px_13px]">
          <Icon name="building" size={17} className="mt-[1px] flex-none text-[var(--info)]" />
          <span className="text-[12.5px] leading-[1.45] text-[var(--text)]">
            These settings apply to <span className="font-semibold">your organization</span> only and never affect other organizations.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* LOGO + NAME */}
          <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
            <h3 className="m-0 mb-[14px] text-[14px] font-semibold text-[var(--text)]">Logo &amp; name</h3>
            <div className="flex items-center gap-[15px]">
              <div
                className="relative flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[16px] text-[30px] font-bold tracking-[-0.02em] text-white"
                style={{ background: draft.logoUrl ? "var(--surface2)" : draft.primary }}
              >
                {logoUploading ? (
                  <Spinner size={20} className="text-[var(--muted)]" />
                ) : draft.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.logoUrl} alt="Org logo" className="h-full w-full object-contain" />
                ) : (
                  logoLetter
                )}
              </div>
              <div className="flex flex-col gap-[8px]">
                <div className="flex items-center gap-[8px]">
                  <label className="flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[12px] py-[7px] text-[12.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                    <Icon name="upload" size={14} />
                    Upload logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      disabled={logoUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onLogoSelected(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {draft.logoUrl && (
                    <button
                      onClick={onLogoRemove}
                      disabled={logoUploading}
                      className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px] py-[7px] text-[12.5px] font-semibold text-[var(--danger)] hover:bg-[var(--dangers)] disabled:opacity-60"
                    >
                      <Icon name="x" size={13} />
                      Remove
                    </button>
                  )}
                </div>
                <span className="text-[11.5px] leading-[1.4] text-[var(--subtle)]">
                  PNG, JPG, SVG or WEBP, up to 2MB. {draft.logoUrl ? "Shown wherever your logo appears." : "Falls back to your brand name's first letter until you upload one."}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Brand name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })}
                className="h-11 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[14px] font-medium text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
              />
            </div>
          </section>

          {/* COLORS */}
          <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
            <h3 className="m-0 mb-1 text-[14px] font-semibold text-[var(--text)]">Colors</h3>
            <p className="m-0 mb-[15px] text-[12px] text-[var(--subtle)]">Stored as tokens — every screen updates automatically.</p>
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-[9px] flex items-center justify-between">
                  <label className="text-[12.5px] font-semibold text-[var(--text)]">Primary</label>
                  <span className="font-mono text-[12px] text-[var(--muted)]">{draft.primary}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRIMARIES.map((c) => {
                    const active = c.toLowerCase() === draft.primary.toLowerCase();
                    return (
                      <button
                        key={c}
                        onClick={() => setDraft((d) => d && { ...d, primary: c })}
                        title={c}
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] border-2"
                        style={{ background: c, borderColor: active ? "var(--text)" : "transparent" }}
                      >
                        {active && <Icon name="check" size={16} className="text-white" />}
                      </button>
                    );
                  })}
                  <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-dashed border-[var(--border)]">
                    <Icon name="plus" size={16} className="text-[var(--subtle)]" />
                    <input
                      type="color"
                      value={draft.primary}
                      onChange={(e) => setDraft((d) => d && { ...d, primary: e.target.value })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-[9px] flex items-center justify-between">
                  <label className="text-[12.5px] font-semibold text-[var(--text)]">Secondary / accent</label>
                  <span className="font-mono text-[12px] text-[var(--muted)]">{draft.secondary}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SECONDARIES.map((c) => {
                    const active = c.toLowerCase() === draft.secondary.toLowerCase();
                    return (
                      <button
                        key={c}
                        onClick={() => setDraft((d) => d && { ...d, secondary: c })}
                        title={c}
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] border-2"
                        style={{ background: c, borderColor: active ? "var(--text)" : "transparent" }}
                      >
                        {active && <Icon name="check" size={16} className="text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* TYPE + CORNER */}
          <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
            <h3 className="m-0 mb-[14px] text-[14px] font-semibold text-[var(--text)]">Typography &amp; shape</h3>
            <label className="mb-2 block text-[12.5px] font-semibold text-[var(--text)]">Font family</label>
            <div className="flex flex-col gap-2">
              {FONTS.map((f) => {
                const active = f.value === draft.font;
                return (
                  <button
                    key={f.value}
                    onClick={() => setDraft((d) => d && { ...d, font: f.value })}
                    className="flex items-center justify-between gap-[10px] rounded-[var(--rad-sm)] border-[1.5px] p-[11px_14px] text-left"
                    style={{ borderColor: active ? "var(--brand)" : "var(--border)", background: active ? "var(--brands)" : "var(--surface)" }}
                  >
                    <span className="text-[15px] font-semibold text-[var(--text)]" style={{ fontFamily: f.stack }}>
                      {f.label}
                    </span>
                    <span className="text-[12px] text-[var(--subtle)]" style={{ fontFamily: f.stack }}>
                      Aa Bb Cc 123
                    </span>
                    {active && (
                      <div className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brandfg)]">
                        <Icon name="check" size={12} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <label className="mb-2 mt-4 block text-[12.5px] font-semibold text-[var(--text)]">Corner radius</label>
            <div className="flex gap-2">
              {CORNERS.map((c) => {
                const active = c.value === draft.corner;
                return (
                  <button
                    key={c.value}
                    onClick={() => setDraft((d) => d && { ...d, corner: c.value })}
                    className="flex flex-1 flex-col items-center gap-2 rounded-[10px] border-[1.5px] p-[13px]"
                    style={{ borderColor: active ? "var(--brand)" : "var(--border)", background: active ? "var(--brands)" : "var(--surface)" }}
                  >
                    <div className="h-6 w-[38px] border-2 border-[var(--brand)] bg-[var(--surface2)]" style={{ borderRadius: c.demo }} />
                    <span className="text-[12px] font-semibold text-[var(--text)]">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* LIVE PREVIEW */}
        <aside className="min-w-0 lg:sticky lg:top-[18px] lg:self-start">
          <div
            style={
              {
                "--brand": draft.primary,
                "--brandfg": "#ffffff",
                "--brands": mixHex(draft.primary, 9, true),
                "--sec": draft.secondary,
                "--secs": mixHex(draft.secondary, 12, true),
                "--rad": cornerRad,
                "--rad-sm": cornerSm,
                fontFamily: fontStack,
              } as React.CSSProperties
            }
          >
            <div className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
              <div className="flex items-center justify-between border-b border-[var(--border2)] p-[13px_16px]">
                <h3 className="m-0 text-[13px] font-semibold text-[var(--text)]">Live preview</h3>
                <span className="font-mono text-[11px] text-[var(--subtle)]">tokens</span>
              </div>
              <div className="bg-[var(--bg)] p-[18px]">
                <div className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)]">
                  <div className="flex items-center gap-[9px] border-b border-[var(--border2)] p-[11px_13px]">
                    <div className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-[8px] bg-[var(--brand)] text-[14px] font-bold text-[var(--brandfg)]">
                      {draft.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.logoUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        logoLetter
                      )}
                    </div>
                    <span className="text-[14px] font-bold text-[var(--text)]">{draft.name}</span>
                    <div className="ml-auto flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--brands)] text-[10px] font-bold text-[var(--brand)]">MB</div>
                  </div>
                  <div className="flex flex-col gap-[11px] p-[14px]">
                    <div className="text-[15px] font-semibold text-[var(--text)]">Good morning, Marcus</div>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-[var(--rad-sm)] bg-[var(--brands)] p-[11px]">
                        <div className="text-[18px] font-bold text-[var(--brand)]">76%</div>
                        <div className="text-[10.5px] text-[var(--muted)]">Completion</div>
                      </div>
                      <div className="flex-1 rounded-[var(--rad-sm)] bg-[var(--surface2)] p-[11px]">
                        <div className="text-[18px] font-bold text-[var(--text)]">12</div>
                        <div className="text-[10.5px] text-[var(--muted)]">Assistants</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-[7px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secs)] px-[9px] py-[3px] text-[10.5px] font-semibold text-[var(--sec)]">
                        <span className="h-[6px] w-[6px] rounded-full bg-[var(--sec)]" />
                        Accent
                      </span>
                      <button className="ml-auto cursor-default rounded-[var(--rad-sm)] bg-[var(--brand)] px-[14px] py-2 text-[12px] font-semibold text-[var(--brandfg)]">
                        Primary action
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="m-0 mt-[11px] px-1 text-[11.5px] leading-[1.5] text-[var(--subtle)]">
            Everyone in your organization sees these colors, font and shape.
          </p>
        </aside>
      </div>

      {/* PARENT WHATSAPP GROUP LINK */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[18px]">
        <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Parent WhatsApp group link</h3>
        <p className="m-0 mt-1 text-[12.5px] text-[var(--subtle)]">
          One shared group link for parents, inserted into the welcome message sent to every new student.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-[10px]">
          <input
            value={parentLink}
            onChange={(e) => setParentLink(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            className="h-[42px] min-w-[280px] flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--bg)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
          />
          <button
            onClick={onSaveParentLink}
            disabled={parentLink === savedParentLink || savingParentLink}
            className="flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
          >
            {savingParentLink ? <Spinner size={15} /> : <Icon name="check" size={15} />}
            Save
          </button>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[13px_18px] shadow-[var(--shadow)]">
        <div className="flex items-center gap-[9px]">
          {dirty ? (
            <span className="inline-flex items-center gap-[6px] text-[12.5px] font-semibold text-[var(--warn)]">
              <span className="h-[7px] w-[7px] rounded-full bg-[var(--warn)]" />
              Unsaved changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-[6px] text-[12.5px] font-medium text-[var(--muted)]">
              <Icon name="check" size={14} className="text-[var(--ok)]" />
              All changes saved
            </span>
          )}
        </div>
        <div className="flex gap-[10px]">
          <button
            onClick={onReset}
            disabled={!dirty}
            className="flex items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)] disabled:opacity-60"
          >
            Reset to system default
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className="flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[17px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
          >
            {saving ? <Spinner size={15} /> : <Icon name="check" size={15} />}
            Save org branding
          </button>
        </div>
      </div>
    </div>
  );
}
