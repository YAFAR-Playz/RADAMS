"use client";

import { useEffect, useState } from "react";
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
  const [rows, setRows] = useState<PlatformStaffMember[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loginAsId, setLoginAsId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await listAllStaff({ page, search, role: roleFilter });
      setRows(res.rows);
      setTotal(res.total);
      setPageSize(res.pageSize);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, roleFilter]);

  // Debounce search input -> committed search, and reset to page 0 on any filter change.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function onRoleChange(id: string, role: Role) {
    setSavingId(id);
    setRows((prev) => (prev ? prev.map((u) => (u.id === id ? { ...u, role } : u)) : prev));
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
      setRows((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
      setTotal((t) => Math.max(0, t - 1));
    } catch {
      setError("Couldn't remove this user — try again.");
    } finally {
      setRemovingId(null);
    }
  }

  async function onLoginAs(id: string) {
    setLoginAsId(id);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { url } = await getOwnerLoginAsLink(id, redirectTo);
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in as this user — try again.");
      setLoginAsId(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

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
        <div className="mt-4 rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[12px_14px]">
          <div className="text-[21px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--brand)]">{total.toLocaleString()}</div>
          <div className="mt-[2px] text-[12px] font-medium text-[var(--muted)]">Total users on the platform</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="flex h-10 min-w-[220px] max-w-[320px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3">
          <Icon name="search" size={16} className="text-[var(--subtle)]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email…"
            className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-[6px]">
          {(["all", ...ROLE_OPTIONS] as const).map((v) => {
            const active = roleFilter === v;
            return (
              <button
                key={v}
                onClick={() => {
                  setPage(0);
                  setRoleFilter(v);
                }}
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
        {loading ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} className="h-[56px]" />
            ))}
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">No users match your search.</div>
        ) : (
          rows.map((u) => (
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
        {!loading && rows && rows.length > 0 && pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-[var(--border2)] p-[10px_16px]">
            <span className="text-[12.5px] text-[var(--subtle)]">
              {page * pageSize + 1}–{Math.min(page * pageSize + pageSize, total)} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-[5px]">
              {Array.from({ length: pageCount }, (_, i) => i)
                .filter((i) => i >= page - 2 && i <= page + 2)
                .map((i) => {
                  const active = i === page;
                  return (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className="h-8 min-w-8 rounded-[7px] border px-2 text-[12.5px] font-semibold"
                      style={
                        active
                          ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                          : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                      }
                    >
                      {i + 1}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
