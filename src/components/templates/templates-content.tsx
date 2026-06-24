"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { getOrgTemplates, saveOrgTemplate, resetOrgTemplate, TEMPLATE_DEFS, type TemplateKey } from "@/lib/actions/templates";

const VARS = ["{student}", "{org}", "{course}", "{assistant_name}", "{assignment}", "{status}", "{grade}", "{session}", "{date}", "{comment}"];

const SAMPLE: Record<string, string> = {
  student: "Liam Carter",
  org: "Cambridge Prep Center",
  course: "Physics · June · U1",
  assistant_name: "Aisha Rahman",
  assignment: "Paper 3 — Mechanics",
  status: "Submitted",
  grade: " (85/100)",
  session: "Week 7 — Lecture",
  date: "18 Jun",
  comment: "Strong on kinematics.",
};

function fill(tpl: string) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (SAMPLE[k] !== undefined ? SAMPLE[k] : m));
}

export function TemplatesContent() {
  const [overrides, setOverrides] = useState<Record<TemplateKey, string | null> | null>(null);
  const [sel, setSel] = useState<TemplateKey>("assignment");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getOrgTemplates();
        setOverrides(data);
        setDraft(data.assignment ?? TEMPLATE_DEFS.find((t) => t.key === "assignment")!.def);
      } catch {
        setError("Couldn't load templates.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function selectTemplate(key: TemplateKey) {
    setSel(key);
    setDraft(overrides?.[key] ?? TEMPLATE_DEFS.find((t) => t.key === key)!.def);
  }

  async function onSave() {
    setSaving(true);
    try {
      await saveOrgTemplate(sel, draft);
      setOverrides((prev) => (prev ? { ...prev, [sel]: draft } : prev));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Couldn't save this template — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    setSaving(true);
    try {
      await resetOrgTemplate(sel);
      setOverrides((prev) => (prev ? { ...prev, [sel]: null } : prev));
      setDraft(TEMPLATE_DEFS.find((t) => t.key === sel)!.def);
    } catch {
      setError("Couldn't reset this template — try again.");
    } finally {
      setSaving(false);
    }
  }

  const current = TEMPLATE_DEFS.find((t) => t.key === sel)!;
  const customized = overrides?.[sel] != null;

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
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Admin · Organization templates</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">WhatsApp message templates</h1>
        <p className="m-0 mt-[3px] max-w-[600px] text-[13px] leading-[1.5] text-[var(--muted)]">
          Customize the WhatsApp messages your organization sends. Each starts from a built-in default.
        </p>
        <div className="mt-[14px] flex items-start gap-[10px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--infos)] p-[11px_13px]">
          <Icon name="building" size={17} className="mt-[1px] flex-none text-[var(--info)]" />
          <span className="text-[12.5px] leading-[1.45] text-[var(--text)]">
            These templates apply to <span className="font-semibold">your organization</span> only. Edit to override the default, or reset to fall back to it.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* TEMPLATE LIST */}
        <section className="self-start overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="border-b border-[var(--border2)] p-[14px_16px]">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Templates</h3>
          </header>
          <div className="p-[7px_8px]">
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <SkeletonRow key={i} className="h-[56px]" />
                ))}
              </div>
            ) : (
              TEMPLATE_DEFS.map((t) => {
                const active = t.key === sel;
                const isCustom = overrides?.[t.key] != null;
                return (
                  <div
                    key={t.key}
                    onClick={() => selectTemplate(t.key)}
                    className="flex cursor-pointer items-center gap-[11px] rounded-[10px] p-[11px] hover:bg-[var(--surface2)]"
                    style={{ background: active ? "var(--brands)" : "transparent" }}
                  >
                    <div
                      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
                      style={{ background: active ? "var(--brand)" : "var(--surface2)", color: active ? "var(--brandfg)" : "var(--muted)" }}
                    >
                      <Icon name={t.icon} size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[var(--text)]">{t.label}</div>
                      <div className="text-[11.5px] text-[var(--subtle)]">{t.usage}</div>
                    </div>
                    {isCustom && (
                      <span className="flex-none rounded-full bg-[var(--brands)] px-[7px] py-[2px] text-[10px] font-bold text-[var(--brand)]">EDITED</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* EDITOR */}
        <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="flex flex-wrap items-center justify-between gap-[10px] border-b border-[var(--border2)] p-[14px_18px]">
            <div>
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">{current.label}</h3>
              <p className="m-0 mt-[2px] text-[12px] text-[var(--subtle)]">{customized ? "Customized for your organization" : "Using built-in default"}</p>
            </div>
            {customized && (
              <button
                onClick={onReset}
                disabled={saving}
                className="flex items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-[7px] text-[12.5px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
              >
                <Icon name="clock" size={14} />
                Reset to default
              </button>
            )}
          </header>
          <div className="flex flex-col gap-[13px] p-[16px_18px]">
            <div>
              <div className="mb-[7px] flex items-center justify-between">
                <label className="text-[12.5px] font-semibold text-[var(--text)]">Message body</label>
                <span className="text-[11px] text-[var(--subtle)]">{draft.length} chars</span>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-[170px] w-full resize-y rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-3 text-[13.5px] leading-[1.6] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
              />
            </div>
            <div>
              <div className="mb-[7px] text-[11.5px] font-semibold text-[var(--muted)]">Insert a variable</div>
              <div className="flex flex-wrap gap-[6px]">
                {VARS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setDraft((d) => d + v)}
                    className="inline-flex items-center gap-[5px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[10px] py-[5px] font-mono text-[11.5px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)]"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-[7px] text-[11.5px] font-semibold text-[var(--muted)]">Preview</div>
              <div className="flex justify-end rounded-[10px] bg-[#0b141a] p-[14px]">
                <div className="max-w-[90%] whitespace-pre-wrap rounded-[10px_10px_2px_10px] bg-[#005c4b] p-[9px_12px] text-[13px] leading-[1.5] text-[#e9edef]">
                  {fill(draft)}
                  <div className="mt-[3px] text-right text-[10px] text-[#8aa6a0]">12:04 ✓✓</div>
                </div>
              </div>
            </div>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex h-11 items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
            >
              {saving ? <Spinner size={15} /> : <Icon name={saved ? "check2" : "check"} size={15} />}
              {saved ? "Saved" : "Save for my organization"}
            </button>
            <p className="m-0 text-[11.5px] leading-[1.5] text-[var(--subtle)]">Saved changes apply only to your organization.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
