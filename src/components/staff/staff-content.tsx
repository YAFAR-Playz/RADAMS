"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import type { Role } from "@/lib/roles";
import {
  listStaff,
  createStaffMember,
  updateStaffMember,
  removeStaffMember,
  resolveStaffingRequest,
  getLoginAsLink,
  getAssignedOfferingIds,
  setStaffCourses,
  assignStaffToCourses,
  type StaffMember,
} from "@/lib/actions/staff";
import { listAllStaffingRequests, type StaffingRequestDetail } from "@/lib/actions/hr";
import { listAllOfferingsForOrg, type OfferingChoice } from "@/lib/actions/students";
import { downloadCsv } from "@/lib/csv-export";
import { consumeSearchHandoff } from "@/lib/search-handoff";
import { pickerOnlyDateProps } from "@/lib/date-input";

const ADMIN_ROLE_OPTIONS: Role[] = ["admin", "hr", "head", "assistant", "registration", "finance"];
const HR_ROLE_OPTIONS: Role[] = ["hr", "head", "assistant", "registration", "finance"];
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

const emptyForm = { name: "", email: "", phone: "", role: "assistant" as Role, courseIds: [] as string[] };

export function StaffContent({ viewerRole = "admin" }: { viewerRole?: "admin" | "hr" }) {
  const isHr = viewerRole === "hr";
  const roleOptions = isHr ? HR_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS;
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [requests, setRequests] = useState<StaffingRequestDetail[] | null>(null);
  const [viewingRequest, setViewingRequest] = useState<StaffingRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Role | "all">("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [offerings, setOfferings] = useState<OfferingChoice[] | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loginAsId, setLoginAsId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null);
  const [removeLeaveDate, setRemoveLeaveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [removeGaveNotice, setRemoveGaveNotice] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [s, r, o] = await Promise.all([listStaff(), listAllStaffingRequests(), listAllOfferingsForOrg()]);
      setStaff(s);
      setRequests(r);
      setOfferings(o);
    } catch {
      setError("Couldn't load staff — try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (() => {
      const handoff = consumeSearchHandoff();
      if (handoff) setSearch(handoff);
    })();
    (async () => {
      await reload();
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!staff) return [];
    const q = search.trim().toLowerCase();
    return staff.filter((u) => {
      if (isHr && (u.role === "admin" || u.role === "owner")) return false;
      if (filter !== "all" && u.role !== filter) return false;
      if (courseFilter !== "all" && !u.offeringIds.includes(courseFilter)) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.role.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, search, filter, courseFilter, isHr]);

  const STAFF_PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / STAFF_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * STAFF_PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + STAFF_PAGE_SIZE);

  const pendingRequests = (requests ?? []).filter((r) => r.status === "pending");

  function onExport() {
    downloadCsv(
      "staff",
      ["Name", "Email", "Phone", "Role", "Joined", "Courses"],
      filtered.map((u) => [u.name, u.email, u.phone ?? "", ROLE_LABEL[u.role], u.joinedAt, u.courses.join("; ")])
    );
  }

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(u: StaffMember) {
    setEditId(u.id);
    setForm({ name: u.name, email: u.email, phone: u.phone ?? "", role: u.role, courseIds: [] });
    setModalOpen(true);
    if (u.role === "head" || u.role === "assistant") {
      setCoursesLoading(true);
      getAssignedOfferingIds(u.id, u.role)
        .then((ids) => setForm((f) => ({ ...f, courseIds: ids })))
        .finally(() => setCoursesLoading(false));
    }
  }

  const showCourses = form.role === "head" || form.role === "assistant";

  function toggleCourse(id: string) {
    setForm((f) => ({ ...f, courseIds: f.courseIds.includes(id) ? f.courseIds.filter((x) => x !== id) : [...f.courseIds, id] }));
  }

  const canSave = form.name.trim().length > 0 && (editId !== null || form.email.trim().length > 0);

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editId) {
        await updateStaffMember(editId, { name: form.name, phone: form.phone, role: form.role });
        if (showCourses) await setStaffCourses(editId, form.role as "head" | "assistant", form.courseIds);
      } else {
        const { id } = await createStaffMember(form);
        if (showCourses && form.courseIds.length) await assignStaffToCourses(id, form.role as "head" | "assistant", form.courseIds);
      }
      setModalOpen(false);
      await reload();
    } catch {
      setError(editId ? "Couldn't save changes — try again." : "Couldn't create this user — try again.");
    } finally {
      setSaving(false);
    }
  }

  function openRemove(u: StaffMember) {
    setRemoveTarget(u);
    setRemoveLeaveDate(new Date().toISOString().slice(0, 10));
    setRemoveGaveNotice(false);
  }

  async function onConfirmRemove() {
    if (!removeTarget) return;
    const id = removeTarget.id;
    setRemovingId(id);
    try {
      await removeStaffMember(id, removeLeaveDate, removeGaveNotice);
      setStaff((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
      setRemoveTarget(null);
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
      const { url } = await getLoginAsLink(id, redirectTo);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in as this user — try again.");
      setLoginAsId(null);
    }
  }

  async function onResolve(id: string, status: "approved" | "declined") {
    setResolvingId(id);
    try {
      await resolveStaffingRequest(id, status);
      setRequests((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, status } : r)) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update this request — try again.");
    } finally {
      setResolvingId(null);
    }
  }

  const stats = staff
    ? [
        { value: String(staff.length), label: "Total users", color: "var(--brand)" },
        { value: String(staff.filter((u) => u.role !== "owner").length), label: "Active staff", color: "var(--ok)" },
        { value: String(pendingRequests.length), label: "Pending requests", color: "var(--warn)" },
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

      {/* HEADER */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">{isHr ? "HR" : "Admin"}</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Users &amp; access</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              {isHr
                ? "Manage staff across the organization. Add or remove non-admin users and review staffing requests."
                : "Manage your organization's users. Add or remove staff and edit their role."}
            </p>
          </div>
          <div className="flex flex-none items-center gap-[8px]">
            <button
              onClick={onExport}
              disabled={filtered.length === 0}
              className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] py-[10px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              <Icon name="file-up" size={16} />
              Export CSV
            </button>
            <button
              onClick={openAdd}
              className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]"
            >
              <Icon name="user-plus" size={16} />
              Add user
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
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

      {/* PENDING REQUESTS */}
      {pendingRequests.length > 0 && (
        <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="flex items-center gap-2 border-b border-[var(--border2)] p-[14px_18px]">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Staffing requests from Heads</h3>
            <span className="rounded-full bg-[var(--warns)] px-2 py-[2px] text-[11px] font-bold text-[var(--warn)]">{pendingRequests.length} pending</span>
          </header>
          <div className="p-[7px_8px]">
            {pendingRequests.map((r) => {
              const title = r.kind === "add" ? "New assistant requested" : r.kind === "remove" ? "Removal requested" : "Replacement requested";
              const who = r.kind === "replace" ? `${r.targetName ?? "—"} → ${r.candidateName ?? "TBD"}` : r.candidateName ?? r.targetName ?? "—";
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[var(--surface2)] text-[var(--text)]">
                    <Icon name={r.kind === "add" ? "user-plus" : r.kind === "remove" ? "x" : "users"} size={16} />
                  </div>
                  <div className="min-w-[150px] flex-1">
                    <div className="text-[13px] font-semibold text-[var(--text)]">{title}</div>
                    <div className="text-[12px] text-[var(--subtle)]">
                      {who} · {r.offeringLabel}
                    </div>
                  </div>
                  <div className="flex flex-none gap-[7px]">
                    <button
                      onClick={() => setViewingRequest(r)}
                      className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[13px] py-[7px] text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)]"
                    >
                      View details
                    </button>
                    <button
                      onClick={() => onResolve(r.id, "approved")}
                      disabled={resolvingId === r.id}
                      className="rounded-[8px] bg-[var(--brand)] px-[13px] py-[7px] text-[12px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onResolve(r.id, "declined")}
                      disabled={resolvingId === r.id}
                      className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[13px] py-[7px] text-[12px] font-semibold text-[var(--muted)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="flex h-10 min-w-[200px] max-w-[300px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3">
          <Icon name="search" size={16} className="text-[var(--subtle)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search users…"
            className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => {
            setCourseFilter(e.target.value);
            setPage(0);
          }}
          className="h-10 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text)] outline-none"
        >
          <option value="all">All courses</option>
          {(offerings ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-[6px]">
          {(isHr
            ? (["all", "head", "assistant", "finance", "registration"] as const)
            : (["all", "admin", "hr", "head", "assistant", "registration", "finance"] as const)
          ).map((v) => {
            const active = filter === v;
            return (
              <button
                key={v}
                onClick={() => {
                  setFilter(v);
                  setPage(0);
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

      {/* USER LIST */}
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
          pageRows.map((u) => {
            const expanded = !!open[u.id];
            return (
              <div key={u.id} className="border-b border-[var(--border2)] last:border-b-0">
                <div className="flex flex-wrap items-center gap-3 p-[12px_16px] hover:bg-[var(--surface2)]">
                  <div className="flex min-w-[180px] flex-1 items-center gap-[11px]">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12.5px] font-bold text-[var(--brand)]">
                      {u.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-[var(--text)]">{u.name}</div>
                      <div className="text-[11.5px] text-[var(--subtle)]">{u.email}</div>
                    </div>
                  </div>
                  <span className="inline-flex flex-none items-center gap-[6px] rounded-[7px] bg-[var(--surface2)] px-[10px] py-[4px] text-[12px] font-semibold text-[var(--muted)]">
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: ROLE_COLOR[u.role] }} />
                    {ROLE_LABEL[u.role]}
                  </span>
                  {u.isMainAdmin && (
                    <span
                      title="Assigned by the platform owner — can't be removed"
                      className="inline-flex flex-none items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[11px] font-semibold"
                      style={{ background: "var(--brands)", color: "var(--brand)" }}
                    >
                      <Icon name="shield" size={11} />
                      Main admin
                    </span>
                  )}
                  <div className="ml-auto flex flex-none items-center gap-[7px]">
                    <button
                      onClick={() => setOpen((p) => ({ ...p, [u.id]: !p[u.id] }))}
                      title="More details"
                      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                    >
                      <Icon name="chevron-down" size={16} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
                    </button>
                    <button
                      onClick={() => openEdit(u)}
                      title="Edit user"
                      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                    >
                      <Icon name="settings" size={15} />
                    </button>
                    {!isHr && u.role !== "owner" && (
                      <button
                        onClick={() => onLoginAs(u.id)}
                        disabled={loginAsId === u.id}
                        title="Sign in as this user"
                        className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[7px] text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:opacity-60"
                      >
                        {loginAsId === u.id ? <Spinner size={13} /> : <Icon name="logout" size={13} />}
                        Login as
                      </button>
                    )}
                    {!u.isMainAdmin && (
                      <button
                        onClick={() => openRemove(u)}
                        disabled={removingId === u.id}
                        title="Remove user"
                        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                      >
                        {removingId === u.id ? <Spinner size={14} /> : <Icon name="x" size={15} />}
                      </button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="grid grid-cols-1 gap-[10px] border-t border-[var(--border2)] bg-[var(--surface2)] p-[12px_16px] sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Phone</div>
                      <div className="mt-[2px] text-[13px] font-semibold text-[var(--text)]">{u.phone ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Courses</div>
                      <div className="mt-[2px] text-[13px] font-semibold text-[var(--text)]">{u.courses.length ? u.courses.join(", ") : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Joined</div>
                      <div className="mt-[2px] text-[13px] font-semibold text-[var(--text)]">{new Date(u.joinedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        {!loading && filtered.length > 0 && pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-[var(--border2)] p-[11px_16px]">
            <span className="text-[12.5px] text-[var(--subtle)]">
              {pageStart + 1}–{Math.min(pageStart + STAFF_PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-[5px]">
              {Array.from({ length: pageCount }, (_, i) => i)
                .filter((i) => i >= safePage - 2 && i <= safePage + 2)
                .map((i) => {
                  const active = i === safePage;
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

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="user-plus" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">{editId ? "Edit user" : "Add user"}</h3>
                {!editId && <div className="text-[12px] text-[var(--muted)]">They&apos;ll sign in with their email</div>}
              </div>
              <button onClick={() => setModalOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto p-[16px_18px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Full name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Jordan Hale"
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  disabled={!!editId}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="name@email.com"
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)] disabled:opacity-60"
                />
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="7700 900000"
                    className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Role</label>
                  <div className="flex h-[42px] items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                    <select
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                      className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {showCourses && (
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Assigned course(s)</label>
                  {coursesLoading ? (
                    <SkeletonRow className="h-[34px]" />
                  ) : (
                    <div className="flex flex-wrap gap-[6px]">
                      {(offerings ?? []).map((o) => {
                        const sel = form.courseIds.includes(o.id);
                        return (
                          <button
                            key={o.id}
                            onClick={() => toggleCourse(o.id)}
                            className="inline-flex items-center gap-[5px] rounded-full border px-[11px] py-[5px] text-[12px] font-semibold"
                            style={
                              sel
                                ? { borderColor: "var(--brand)", background: "var(--brands)", color: "var(--brand)" }
                                : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                            }
                          >
                            {sel && <Icon name="check" size={12} />}
                            {o.label}
                          </button>
                        );
                      })}
                      {(offerings ?? []).length === 0 && <span className="text-[12.5px] text-[var(--subtle)]">No course offerings yet.</span>}
                    </div>
                  )}
                </div>
              )}
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
                {editId ? "Save changes" : "Add user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex w-full max-w-[420px] flex-col rounded-[var(--rad)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-3 border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-[var(--dangers)] text-[var(--danger)]">
                <Icon name="x" size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Remove {removeTarget.name}?</h3>
                <div className="text-[12px] text-[var(--muted)]">This deletes their account and login access.</div>
              </div>
              <button onClick={() => setRemoveTarget(null)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[14px] p-[16px_18px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Leave date</label>
                <input
                  type="date"
                  value={removeLeaveDate}
                  onChange={(e) => setRemoveLeaveDate(e.target.value)}
                  {...pickerOnlyDateProps}
                  className="h-10 w-full cursor-pointer rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-[9px] text-[13px] font-medium text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={removeGaveNotice}
                  onChange={(e) => setRemoveGaveNotice(e.target.checked)}
                  className="h-[17px] w-[17px] cursor-pointer accent-[var(--brand)]"
                />
                Gave two weeks&apos; notice
              </label>
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button onClick={() => setRemoveTarget(null)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onConfirmRemove}
                disabled={removingId === removeTarget.id}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--danger)] text-[13.5px] font-semibold text-white disabled:opacity-60"
              >
                {removingId === removeTarget.id ? <Spinner size={15} /> : <Icon name="x" size={15} />}
                Remove user
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Request details</h3>
                <div className="text-[12px] text-[var(--muted)]">
                  Requested by {viewingRequest.requestedByName ?? "—"} · {new Date(viewingRequest.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => setViewingRequest(null)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[13px] p-[18px]">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Course</div>
                <div className="text-[13.5px] text-[var(--text)]">{viewingRequest.offeringLabel}</div>
              </div>
              {(viewingRequest.kind === "remove" || viewingRequest.kind === "replace") && (
                <div className="rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_13px]">
                  <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
                    {viewingRequest.kind === "replace" ? "Outgoing" : "Staff member"}
                  </div>
                  <div className="flex flex-col gap-[9px]">
                    <div className="text-[13.5px] font-semibold text-[var(--text)]">{viewingRequest.targetName ?? "—"}</div>
                    <div className="grid grid-cols-2 gap-[9px]">
                      {(viewingRequest.kind === "remove" ? viewingRequest.proposedDate : viewingRequest.leaveDate) && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-[var(--subtle)]">Leave date</div>
                          <div className="text-[13px] text-[var(--text)]">
                            {new Date((viewingRequest.kind === "remove" ? viewingRequest.proposedDate : viewingRequest.leaveDate) as string).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      {viewingRequest.gaveNotice !== null && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-[var(--subtle)]">Gave notice</div>
                          <div className="text-[13px] text-[var(--text)]">{viewingRequest.gaveNotice ? "Yes" : "No"}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {(viewingRequest.kind === "add" || viewingRequest.kind === "replace") && (
                <div className="rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_13px]">
                  <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
                    {viewingRequest.kind === "replace" ? "Incoming candidate" : "Candidate"}
                  </div>
                  <div className="flex flex-col gap-[9px]">
                    <div className="text-[13.5px] font-semibold text-[var(--text)]">{viewingRequest.candidateName ?? "Not provided yet"}</div>
                    <div className="grid grid-cols-2 gap-[9px]">
                      {viewingRequest.candidatePhone && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-[var(--subtle)]">Phone</div>
                          <div className="font-mono text-[13px] text-[var(--text)]">{viewingRequest.candidatePhone}</div>
                        </div>
                      )}
                      {viewingRequest.candidateEmail && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-[var(--subtle)]">Email</div>
                          <div className="text-[13px] text-[var(--text)]">{viewingRequest.candidateEmail}</div>
                        </div>
                      )}
                      {viewingRequest.proposedDate && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-[var(--subtle)]">Proposed start</div>
                          <div className="text-[13px] text-[var(--text)]">{new Date(viewingRequest.proposedDate).toLocaleDateString()}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {viewingRequest.reason && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Reason</div>
                  <div className="text-[13.5px] leading-[1.5] text-[var(--text)]">{viewingRequest.reason}</div>
                </div>
              )}
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button
                onClick={() => setViewingRequest(null)}
                className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                Close
              </button>
              {viewingRequest.status === "pending" && (
                <button
                  onClick={() => {
                    onResolve(viewingRequest.id, "approved");
                    setViewingRequest(null);
                  }}
                  disabled={resolvingId === viewingRequest.id}
                  className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                >
                  <Icon name="check" size={15} />
                  Approve
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
