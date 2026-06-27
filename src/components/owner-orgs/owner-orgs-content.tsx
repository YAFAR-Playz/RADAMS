"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  listOrgsOverview,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOwnerLoginAsLink,
  type OrgOverview,
} from "@/lib/actions/owner";

const METRIC_DEFS: { key: keyof OrgOverview["metrics"]; icon: "grad" | "user-check" | "book" | "clipboard-list"; label: string }[] = [
  { key: "students", icon: "grad", label: "Students" },
  { key: "assistants", icon: "user-check", label: "Assistants" },
  { key: "heads", icon: "grad", label: "Heads" },
  { key: "courses", icon: "book", label: "Courses" },
  { key: "assignments", icon: "clipboard-list", label: "Assignments" },
];

const STATUS_BADGE: Record<OrgOverview["status"], { text: string; bg: string; fg: string }> = {
  active: { text: "Active", bg: "var(--oks)", fg: "var(--ok)" },
  trial: { text: "Trial", bg: "var(--infos)", fg: "var(--info)" },
  suspended: { text: "Suspended", bg: "var(--dangers)", fg: "var(--danger)" },
};

const emptyForm = { name: "", adminName: "", adminPhone: "", adminEmail: "" };

export function OwnerOrgsContent() {
  const [orgs, setOrgs] = useState<OrgOverview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loginAsId, setLoginAsId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setOrgs(await listOrgsOverview());
    } catch {
      setError("Couldn't load organizations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(o: OrgOverview) {
    setEditId(o.id);
    setForm({ name: o.name, adminName: o.adminName ?? "", adminPhone: o.adminPhone ?? "", adminEmail: o.adminEmail ?? "" });
    setModalOpen(true);
  }

  const canSave = form.name.trim().length > 0 && (editId !== null || form.adminEmail.trim().length > 0);

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editId) {
        const org = orgs?.find((o) => o.id === editId);
        await updateOrganization(editId, { name: form.name, adminId: org?.adminId ?? null, adminName: form.adminName, adminPhone: form.adminPhone });
      } else {
        await createOrganization(form);
      }
      setModalOpen(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this organization — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this organization? This removes all of its data permanently.")) return;
    setBusyId(id);
    try {
      await deleteOrganization(id);
      setOrgs((prev) => (prev ? prev.filter((o) => o.id !== id) : prev));
    } catch {
      setError("Couldn't delete this organization — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onLoginAs(o: OrgOverview) {
    if (!o.adminId) {
      setError("This organization has no admin to sign in as.");
      return;
    }
    setLoginAsId(o.id);
    try {
      const redirectTo = `${window.location.origin}/dashboard`;
      const { url } = await getOwnerLoginAsLink(o.adminId, redirectTo);
      window.location.assign(url);
    } catch {
      setError("Couldn't sign in as this admin — try again.");
      setLoginAsId(null);
    }
  }

  const stats = orgs
    ? [
        { value: String(orgs.length), label: "Organizations", color: "var(--brand)" },
        { value: String(orgs.filter((o) => o.status === "active").length), label: "Active", color: "var(--ok)" },
        { value: orgs.reduce((s, o) => s + o.metrics.students, 0).toLocaleString(), label: "Total students", color: "var(--text)" },
        { value: String(orgs.reduce((s, o) => s + o.metrics.courses, 0)), label: "Total courses", color: "var(--text)" },
      ]
    : [];

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Owner · Platform</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Organizations</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              Manage every organization and its admin. Sign in as any admin to troubleshoot.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]"
          >
            <Icon name="plus" size={16} />
            New organization
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading || !orgs
            ? Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} className="h-[58px]" />)
            : stats.map((s) => (
                <div key={s.label} className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[12px_14px]">
                  <div className="text-[21px] font-bold leading-[1.1] tracking-[-0.02em]" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="mt-[2px] text-[12px] font-medium text-[var(--muted)]">{s.label}</div>
                </div>
              ))}
        </div>
      </div>

      <div className="flex flex-col gap-[14px]">
        {loading && !orgs ? (
          Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[140px]" />)
        ) : orgs && orgs.length === 0 ? (
          <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[13.5px] text-[var(--muted)] shadow-[var(--shadow)]">
            No organizations yet.
          </div>
        ) : (
          orgs?.map((o) => {
            const badge = STATUS_BADGE[o.status];
            return (
              <section key={o.id} className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border2)] p-[14px_16px]">
                  <div
                    className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] text-[16px] font-bold text-white"
                    style={{ background: o.primaryColor }}
                  >
                    {o.mark}
                  </div>
                  <div className="min-w-[130px] flex-[1_1_150px]">
                    <div className="text-[15px] font-bold tracking-[-0.01em] text-[var(--text)]">{o.name}</div>
                    <div className="text-[12px] text-[var(--subtle)]">
                      {o.adminName ? `Admin: ${o.adminName}` : "No admin assigned"}
                      {o.adminPhone ? ` · ${o.adminPhone}` : ""}
                    </div>
                  </div>
                  <span
                    className="inline-flex flex-none items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
                    style={{ background: badge.bg, color: badge.fg }}
                  >
                    <span className="h-[6px] w-[6px] rounded-full" style={{ background: badge.fg }} />
                    {badge.text}
                  </span>
                  <button
                    onClick={() => onLoginAs(o)}
                    disabled={loginAsId === o.id || !o.adminId}
                    title={o.adminId ? "Sign in as this org's admin" : "No admin to sign in as"}
                    className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[12px] py-[7px] text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:opacity-60"
                  >
                    {loginAsId === o.id ? <Spinner size={13} /> : <Icon name="logout" size={13} />}
                    Login as admin
                  </button>
                  <button
                    onClick={() => openEdit(o)}
                    title="Edit organization"
                    className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                  >
                    <Icon name="settings" size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(o.id)}
                    disabled={busyId === o.id}
                    title="Delete organization"
                    className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                  >
                    {busyId === o.id ? <Spinner size={14} /> : <Icon name="x" size={15} />}
                  </button>
                </header>
                <div className="grid grid-cols-2 gap-[10px] p-[14px_16px] sm:grid-cols-3 lg:grid-cols-5">
                  {METRIC_DEFS.map((m) => (
                    <div key={m.key} className="flex items-center gap-[9px] rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[10px_11px]">
                      <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
                        <Icon name={m.icon} size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-bold leading-[1.1] text-[var(--text)]">{o.metrics[m.key].toLocaleString()}</div>
                        <div className="text-[10.5px] text-[var(--subtle)]">{m.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[88vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="building" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">{editId ? "Edit organization" : "New organization"}</h3>
                <div className="text-[12px] text-[var(--muted)]">Set the organization and its main admin</div>
              </div>
              <button onClick={() => setModalOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-col gap-[13px] overflow-y-auto p-[16px_18px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Organization name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Riverside Tutoring"
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div className="h-px bg-[var(--border2)]" />
              <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Main admin</div>
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Admin name</label>
                <input
                  value={form.adminName}
                  onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                  placeholder="e.g. Sara Mensah"
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-[10px]">
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Admin phone</label>
                  <input
                    value={form.adminPhone}
                    onChange={(e) => setForm((f) => ({ ...f, adminPhone: e.target.value }))}
                    placeholder="7700 900000"
                    className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Admin email</label>
                  <input
                    type="email"
                    value={form.adminEmail}
                    disabled={!!editId}
                    onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                    placeholder="admin@org.edu"
                    className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)] disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button onClick={() => setModalOpen(false)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!canSave || saving}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {saving ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                {editId ? "Save changes" : "Create organization"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
