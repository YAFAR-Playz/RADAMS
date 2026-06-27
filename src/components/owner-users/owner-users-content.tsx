"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import type { Role } from "@/lib/roles";
import { listAllStaff, updateAnyStaffRole, removeAnyStaffMember, getOwnerLoginAsLink, type PlatformStaffMember } from "@/lib/actions/owner";

const ROLE_OPTIONS: Role[] = ["owner", "admin", "hr", "head", "assistant", "registration", "finance"];
const ROLE_COLOR: Record<Role, string> = {
  owner: "#7c3aed",
  admin: "#2563eb",
  hr: "#0891b2",
  head: "#0d9488",
  assistant: "#16a34a",
  registration: "#ea580c",
  finance: "#db2777",
};
const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  hr: "HR",
  head: "Head",
  assistant: "Assistant",
  registration: "Registration",
  finance: "Finance",
};

export function OwnerUsersContent() {
  const [staff, setStaff] = useState<PlatformStaffMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loginAsId, setLoginAsId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setStaff(await listAllStaff());
    } catch {
      setError("Couldn't load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!staff) return [];
    const q = search.trim().toLowerCase();
    return staff.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.orgName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, search, roleFilter]);

  async function onRoleChange(id: string, role: Role) {
    setSavingId(id);
    setStaff((prev) => (prev ? prev.map((u) => (u.id === id ? { ...u, role } : u)) : prev));
    try {
      await updateAnyStaffRole(id, role);
    } catch {
      setError("Couldn't update this user's role — try again.");
      await reload();
    } finally {
      setSavingId(null);
    }
  }

  async function onRemove(id: string) {
    if (!confirm("Remove this user? This deletes their account permanently.")) return;
    setRemovingId(id);
    try {
      await removeAnyStaffMember(id);
      setStaff((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
    } catch {
      setError("Couldn't remove this user — try again.");
    } finally {
      setRemovingId(null);
    }
  }

  async function onLoginAs(id: string) {
    setLoginAsId(id);
    try {
      const redirectTo = `${window.location.origin}/dashboard`;
      const { url } = await getOwnerLoginAsLink(id, redirectTo);
      window.location.assign(url);
    } catch {
      setError("Couldn't sign in as this user — try again.");
      setLoginAsId(null);
    }
  }

  const stats = staff
    ? [
        { value: String(staff.length), label: "Total users", color: "var(--brand)" },
        { value: String(new Set(staff.map((u) => u.orgId)).size), label: "Organizations represented", color: "var(--ok)" },
        { value: String(staff.filter((u) => u.role === "admin").length), label: "Admins", color: "var(--text)" },
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
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Owner · all organizations</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Users</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Every user across every organization on the platform.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {loading || !staff
            ? Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[58px]" />)
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

      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="flex h-10 min-w-[220px] max-w-[320px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3">
          <Icon name="search" size={16} className="text-[var(--subtle)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or organization…"
            className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-[6px]">
          {(["all", ...ROLE_OPTIONS] as const).map((v) => {
            const active = roleFilter === v;
            return (
              <button
                key={v}
                onClick={() => setRoleFilter(v)}
                className="rounded-full border px-3 py-[7px] text-[12.5px] font-semibold"
                style={
                  active
                    ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                    : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                }
              >
                {v === "all" ? "All roles" : ROLE_LABEL[v]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {loading && !staff ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} className="h-[56px]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">No users match your search.</div>
        ) : (
          filtered.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--border2)] p-[12px_16px] last:border-b-0 hover:bg-[var(--surface2)]">
              <div className="flex min-w-[180px] flex-1 items-center gap-[11px]">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12.5px] font-bold text-[var(--brand)]">
                  {u.initials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-[6px] text-[13.5px] font-semibold text-[var(--text)]">
                    {u.name}
                    {u.isMainAdmin && <Icon name="shield" size={12} className="text-[var(--brand)]" />}
                  </div>
                  <div className="text-[11.5px] text-[var(--subtle)]">{u.email}</div>
                </div>
              </div>
              <div className="min-w-[140px] flex-1 text-[12.5px] font-medium text-[var(--muted)]">{u.orgName}</div>
              <div className="flex h-9 flex-none items-center gap-[6px] rounded-[7px] bg-[var(--surface2)] px-[10px]">
                <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: ROLE_COLOR[u.role] }} />
                <select
                  value={u.role}
                  disabled={savingId === u.id}
                  onChange={(e) => onRoleChange(u.id, e.target.value as Role)}
                  className="cursor-pointer appearance-none border-none bg-transparent text-[12px] font-semibold text-[var(--text)] outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                {savingId === u.id && <Spinner size={12} className="text-[var(--subtle)]" />}
              </div>
              <div className="ml-auto flex flex-none items-center gap-[7px]">
                <button
                  onClick={() => onLoginAs(u.id)}
                  disabled={loginAsId === u.id}
                  title="Sign in as this user"
                  className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[7px] text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:opacity-60"
                >
                  {loginAsId === u.id ? <Spinner size={13} /> : <Icon name="logout" size={13} />}
                  Login as
                </button>
                {!u.isMainAdmin && (
                  <button
                    onClick={() => onRemove(u.id)}
                    disabled={removingId === u.id}
                    title="Remove user"
                    className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                  >
                    {removingId === u.id ? <Spinner size={14} /> : <Icon name="x" size={15} />}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
