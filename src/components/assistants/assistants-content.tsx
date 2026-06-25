"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import {
  getAssistantGroups,
  reassignToGroup,
  autoAssignUnassigned,
  listStaffingRequests,
  createStaffingRequest,
  cancelStaffingRequest,
  type AssistantGroup,
  type UnassignedStudent,
  type StaffingRequest,
} from "@/lib/actions/assistant-groups";

type Kind = "add" | "remove" | "replace";

const KIND_META: Record<Kind, { title: string; icon: "user-plus" | "x" | "users" }> = {
  add: { title: "Request a new assistant", icon: "user-plus" },
  remove: { title: "Request to remove an assistant", icon: "x" },
  replace: { title: "Request to replace an assistant", icon: "users" },
};

export function AssistantsContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [groups, setGroups] = useState<AssistantGroup[] | null>(null);
  const [unassigned, setUnassigned] = useState<UnassignedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<StaffingRequest[] | null>(null);

  const [autoOpen, setAutoOpen] = useState(false);
  const [autoStrategy, setAutoStrategy] = useState<"equal" | "alpha">("equal");
  const [autoRunning, setAutoRunning] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("add");
  const [target, setTarget] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [reason, setReason] = useState("");
  const [proposedDate, setProposedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
    listStaffingRequests().then(setRequests);
  }, []);

  async function reload(id: string) {
    setLoading(true);
    try {
      const { groups, unassigned } = await getAssistantGroups(id);
      setGroups(groups);
      setUnassigned(unassigned);
      setOpen((prev) => (Object.keys(prev).length ? prev : { [groups[0]?.id ?? ""]: true }));
    } catch {
      setError("Couldn't load assistant groups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!offeringId) {
        setGroups([]);
        setUnassigned([]);
        return;
      }
      setOpen({});
      await reload(offeringId);
    })();
  }, [offeringId]);

  function toggleGroup(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function onReassign(enrollmentId: string, studentId: string, assistantId: string) {
    if (!offeringId) return;
    setReassigning(studentId);
    try {
      await reassignToGroup(enrollmentId, assistantId);
      await reload(offeringId);
    } catch {
      setError("Couldn't reassign this student — try again.");
    } finally {
      setReassigning(null);
    }
  }

  async function onRunAuto() {
    if (!offeringId) return;
    setAutoRunning(true);
    try {
      await autoAssignUnassigned(offeringId, autoStrategy);
      setAutoOpen(false);
      await reload(offeringId);
    } catch {
      setError("Couldn't auto-assign students — try again.");
    } finally {
      setAutoRunning(false);
    }
  }

  function openRequestModal(k: Kind, targetName?: string) {
    setKind(k);
    setTarget(targetName ?? groups?.[0]?.name ?? "");
    setCandidateName("");
    setCandidatePhone("");
    setCandidateEmail("");
    setReason("");
    setProposedDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  async function onSubmitRequest() {
    if (!offeringId) return;
    setSubmitting(true);
    try {
      const targetAssistant = groups?.find((g) => g.name === target) ?? null;
      await createStaffingRequest({
        offeringId,
        kind,
        targetAssistantId: kind !== "add" ? targetAssistant?.id ?? null : null,
        candidateName,
        candidatePhone,
        candidateEmail,
        reason,
        proposedDate,
      });
      setModalOpen(false);
      setRequests(await listStaffingRequests());
    } catch {
      setError("Couldn't submit this request — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancelRequest(id: string) {
    try {
      await cancelStaffingRequest(id);
      setRequests((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch {
      setError("Couldn't withdraw this request — try again.");
    }
  }

  const offeringsLoading = offerings === null;
  const needsTarget = kind !== "add";
  const meta = KIND_META[kind];

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
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Assistants</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Team &amp; student groups</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Request staffing changes and assign students to each assistant&apos;s group.</p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-[9px]">
            <button
              onClick={() => setAutoOpen(true)}
              disabled={unassigned.length === 0}
              title={unassigned.length === 0 ? "No unassigned students on this course" : "Auto-assign unassigned students"}
              className="flex items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--brand)] bg-[var(--surface)] px-[14px] py-[10px] text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--subtle)] disabled:hover:bg-[var(--surface)]"
            >
              <Icon name="users" size={16} />
              Auto-assign
              <span
                className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[11px] font-bold"
                style={
                  unassigned.length === 0
                    ? { background: "var(--surface2)", color: "var(--subtle)" }
                    : { background: "var(--brand)", color: "var(--brandfg)" }
                }
              >
                {unassigned.length}
              </span>
            </button>
            <button
              onClick={() => openRequestModal("add")}
              className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]"
            >
              <Icon name="user-plus" size={16} />
              Request assistant
            </button>
          </div>
        </div>

        <div className="mt-[15px] flex flex-wrap items-center gap-2">
          <span className="mr-[2px] flex-none text-[12.5px] font-semibold text-[var(--muted)]">Offering</span>
          {offeringsLoading ? (
            <>
              <SkeletonRow className="h-[36px] w-[150px]" />
              <SkeletonRow className="h-[36px] w-[130px]" />
            </>
          ) : offerings && offerings.length ? (
            offerings.map((o) => {
              const active = o.id === offeringId;
              return (
                <button
                  key={o.id}
                  onClick={() => setOfferingId(o.id)}
                  className="flex flex-none items-center gap-[7px] rounded-full border px-[13px] py-2 text-[13px] font-semibold"
                  style={
                    active
                      ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                      : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                  }
                >
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: active ? "var(--brandfg)" : "var(--subtle)" }} />
                  {o.label}
                </button>
              );
            })
          ) : (
            <span className="text-[13px] text-[var(--subtle)]">No courses yet.</span>
          )}
        </div>
      </div>

      {/* PENDING REQUESTS */}
      {requests && requests.length > 0 && (
        <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="border-b border-[var(--border2)] p-[14px_18px]">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">
              My staffing requests <span className="font-normal text-[var(--subtle)]">· sent to HR</span>
            </h3>
          </header>
          <div className="p-[7px_8px]">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[var(--brands)] text-[var(--brand)]">
                  <Icon name={r.kind === "add" ? "user-plus" : r.kind === "remove" ? "x" : "users"} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">
                    {r.kind === "add" ? "New assistant requested" : r.kind === "remove" ? "Removal requested" : "Replacement requested"}
                  </div>
                  <div className="text-[12px] text-[var(--subtle)]">
                    {r.targetName ?? r.candidateName ?? "—"} · {r.offeringLabel}
                  </div>
                </div>
                <span className="inline-flex flex-none items-center gap-[5px] rounded-full bg-[var(--warns)] px-[9px] py-[3px] text-[11px] font-semibold text-[var(--warn)]">
                  <Icon name="clock" size={12} />
                  Pending HR
                </span>
                <button
                  onClick={() => onCancelRequest(r.id)}
                  title="Withdraw request"
                  className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)]"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ASSISTANT GROUPS */}
      <div className="flex flex-col gap-[14px]">
        {loading && !groups ? (
          Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[80px]" />)
        ) : !groups || groups.length === 0 ? (
          <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[13.5px] text-[var(--muted)] shadow-[var(--shadow)]">
            No assistants assigned to this course yet.
          </div>
        ) : (
          groups.map((g) => {
            const expanded = !!open[g.id];
            return (
              <section key={g.id} className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <header className="flex flex-wrap items-center gap-[11px] border-b border-[var(--border2)] p-[13px_16px]">
                  <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
                    {g.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[var(--text)]">{g.name}</div>
                    <div className="text-[12px] text-[var(--subtle)]">
                      {g.students.length} students · {g.students.length >= 20 ? "Heavy load" : g.students.length >= 10 ? "Balanced" : "Light load"}
                    </div>
                  </div>
                  <button
                    onClick={() => openRequestModal("replace", g.name)}
                    className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)]"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => openRequestModal("remove", g.name)}
                    className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12px] font-semibold text-[var(--muted)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)]"
                  >
                    Remove
                  </button>
                </header>
                <div className="p-[10px_12px]">
                  <div
                    onClick={() => toggleGroup(g.id)}
                    className="flex cursor-pointer items-center gap-[10px] rounded-[9px] bg-[var(--surface2)] p-[8px_10px] hover:bg-[var(--border2)]"
                  >
                    <Icon name="chevron-down" size={16} className="flex-none text-[var(--muted)]" style={{ transform: expanded ? "none" : "rotate(-90deg)" }} />
                    <span className="text-[12.5px] font-semibold text-[var(--text)]">{g.students.length} students assigned</span>
                    <span className="ml-auto text-[11.5px] text-[var(--subtle)]">{expanded ? "Hide" : "Show"}</span>
                  </div>
                  {expanded && (
                    <>
                      {g.students.length === 0 ? (
                        <span className="block p-[6px_4px] text-[12.5px] text-[var(--subtle)]">No students assigned yet.</span>
                      ) : (
                        <div className="mt-2 grid grid-cols-1 gap-[4px] md:grid-cols-2">
                          {g.students.map((st) => (
                            <div key={st.id} className="flex items-center gap-2 rounded-[8px] p-[6px_8px] hover:bg-[var(--surface2)]">
                              <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--surface2)] text-[9.5px] font-bold text-[var(--muted)]">
                                {st.initials}
                              </div>
                              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-medium text-[var(--text)]">
                                {st.name}
                              </span>
                              <div className="flex h-[26px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[7px]">
                                {reassigning === st.id && <Spinner size={11} className="mr-1 text-[var(--subtle)]" />}
                                <span className="mr-[2px] text-[10px] font-semibold text-[var(--subtle)]">→</span>
                                <select
                                  defaultValue={g.name}
                                  onChange={(e) => {
                                    const targetGroup = groups.find((x) => x.name === e.target.value);
                                    if (!targetGroup) return;
                                    onReassign(st.enrollmentId, st.id, targetGroup.id);
                                  }}
                                  title="Reassign to another assistant"
                                  className="max-w-[84px] cursor-pointer appearance-none border-none bg-transparent text-[10.5px] font-bold text-[var(--brand)] outline-none"
                                >
                                  {groups.map((gg) => (
                                    <option key={gg.id} value={gg.name}>
                                      {gg.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* REQUEST MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[450px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name={meta.icon} size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">{meta.title}</h3>
                <div className="text-[12px] text-[var(--muted)]">Sent to HR for approval</div>
              </div>
              <button onClick={() => setModalOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[14px] p-[16px_18px]">
              <div className="flex gap-[6px] rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] p-[3px]">
                {(["add", "replace", "remove"] as Kind[]).map((k) => {
                  const active = kind === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className="h-9 flex-1 rounded-[8px] text-[12.5px] font-semibold"
                      style={active ? { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow)" } : { color: "var(--muted)" }}
                    >
                      {k === "add" ? "New" : k === "replace" ? "Replace" : "Remove"}
                    </button>
                  );
                })}
              </div>

              {needsTarget && (
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">
                    {kind === "remove" ? "Assistant to remove" : "Assistant being replaced"}
                  </label>
                  <div className="flex h-[42px] items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                    <select
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
                    >
                      {(groups ?? []).map((g) => (
                        <option key={g.id} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {kind !== "remove" && (
                <>
                  <div className="flex items-center gap-[7px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
                    <Icon name="user-plus" size={13} />
                    {kind === "replace" ? "Replacement assistant details" : "Candidate details"}
                  </div>
                  <div>
                    <label className="mb-[6px] block text-[12.5px] font-semibold text-[var(--text)]">Full name</label>
                    <input
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="e.g. Jordan Hale"
                      className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-[10px]">
                    <div>
                      <label className="mb-[6px] block text-[12.5px] font-semibold text-[var(--text)]">Phone</label>
                      <input
                        value={candidatePhone}
                        onChange={(e) => setCandidatePhone(e.target.value)}
                        placeholder="7700 900000"
                        className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 font-mono text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                      />
                    </div>
                    <div>
                      <label className="mb-[6px] block text-[12.5px] font-semibold text-[var(--text)]">Email</label>
                      <input
                        type="email"
                        value={candidateEmail}
                        onChange={(e) => setCandidateEmail(e.target.value)}
                        placeholder="name@email.com"
                        className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">
                  {kind === "remove" ? "Leave date" : "Proposed start date"}
                </label>
                <input
                  type="date"
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>

              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">
                  {kind === "add" ? "Why is another assistant needed?" : "Reason for this request"}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Add context for HR…"
                  className="h-[72px] w-full resize-none rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_12px] text-[13px] leading-[1.5] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
            </div>
            <div className="flex gap-[10px] p-[0_18px_16px]">
              <button onClick={() => setModalOpen(false)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onSubmitRequest}
                disabled={submitting}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {submitting ? <Spinner size={15} /> : <Icon name="send" size={15} />}
                Submit to HR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-ASSIGN MODAL */}
      {autoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="users" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Auto-assign students</h3>
                <div className="text-[12px] text-[var(--muted)]">{unassigned.length} students not yet assigned to an assistant</div>
              </div>
              <button onClick={() => setAutoOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[10px] p-[16px_18px]">
              <div className="text-[12.5px] font-semibold text-[var(--text)]">Choose a distribution method</div>
              {(
                [
                  { key: "equal" as const, icon: "chart" as const, title: "Equal distribution", desc: "Spread students evenly across all assistants (round-robin) to balance load." },
                  { key: "alpha" as const, icon: "clipboard-list" as const, title: "Alphabetical blocks", desc: "Sort A→Z and assign in contiguous blocks, so each assistant gets a name range." },
                ]
              ).map((s) => {
                const active = autoStrategy === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setAutoStrategy(s.key)}
                    className="flex items-start gap-[11px] rounded-[var(--rad-sm)] border-[1.5px] p-[13px] text-left"
                    style={{ borderColor: active ? "var(--brand)" : "var(--border)", background: active ? "var(--brands)" : "var(--surface)" }}
                  >
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--brand)]">
                      <Icon name={s.icon} size={16} />
                    </div>
                    <div>
                      <div className="text-[13.5px] font-semibold text-[var(--text)]">{s.title}</div>
                      <div className="text-[12px] leading-[1.45] text-[var(--muted)]">{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-[10px] p-[0_18px_16px]">
              <button onClick={() => setAutoOpen(false)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onRunAuto}
                disabled={autoRunning}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {autoRunning ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                Assign {unassigned.length} students
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
