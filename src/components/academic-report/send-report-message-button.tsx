"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { applyTemplateVars } from "@/lib/message-vars";

type Recipient = "student" | "parent";

export type ReportMessageTemplates = { student: string; parent: string };

export function SendReportMessageButton({
  compact,
  templates,
  orgName,
  courseName,
  monthLabel,
  studentName,
  studentInitials,
  guardianName,
  phone,
  guardianPhone,
  driveFolderLink,
  avgGradeDisplay,
}: {
  compact?: boolean;
  templates: ReportMessageTemplates | null;
  orgName: string;
  courseName: string;
  monthLabel: string;
  studentName: string;
  studentInitials: string;
  guardianName: string | null;
  phone: string | null;
  guardianPhone: string | null;
  driveFolderLink: string | null;
  avgGradeDisplay: string;
}) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState<Recipient>("parent");

  const activeTemplate = recipient === "student" ? templates?.student : templates?.parent;
  const message = activeTemplate
    ? applyTemplateVars(activeTemplate, {
        student: studentName,
        org: orgName,
        course: courseName,
        month: monthLabel,
        grade: avgGradeDisplay,
        link: driveFolderLink ?? "",
      })
    : "";
  const phoneNumber = recipient === "student" ? phone : guardianPhone;
  const waUrl = `https://wa.me/${(phoneNumber ?? "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;

  const btnClass = compact
    ? "flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
    : "flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60";

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={!templates}
        title="Send message"
        className={btnClass}
      >
        <Icon name="send" size={compact ? 14 : 16} />
        {!compact && "Message"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-[440px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[rgba(37,211,102,0.14)] text-[#1ea952]">
                <Icon name="send" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Send monthly report via WhatsApp</h3>
                <div className="text-[12px] text-[var(--muted)]">Review the message before opening WhatsApp</div>
              </div>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="p-[18px]">
              <div className="mb-[11px] flex gap-[6px] rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] p-[3px]">
                {(["student", "parent"] as Recipient[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRecipient(r)}
                    className="flex-1 rounded-[7px] py-[7px] text-[12.5px] font-semibold"
                    style={{
                      background: recipient === r ? "var(--surface)" : "transparent",
                      color: recipient === r ? "var(--text)" : "var(--muted)",
                      boxShadow: recipient === r ? "var(--shadow)" : "none",
                    }}
                  >
                    {r === "student" ? "To student" : "To parent"}
                  </button>
                ))}
              </div>
              <div className="mb-[15px] flex items-center gap-[11px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_13px]">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                  {studentInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">
                    {recipient === "student" ? studentName : guardianName ?? `${studentName.split(" ")[0]}'s guardian`}
                  </div>
                  <div className="font-mono text-[12px] text-[var(--muted)]">{phoneNumber ?? "No phone on file"}</div>
                </div>
              </div>
              {!driveFolderLink && (
                <div className="mb-[11px] rounded-[var(--rad-sm)] border border-[var(--warn)] bg-[var(--warns)] p-[9px_11px] text-[12px] font-medium text-[var(--warn)]">
                  This student hasn&apos;t been sent to Drive yet — the report link won&apos;t be included until you use Send to Drive.
                </div>
              )}
              <div className="mb-[7px] text-[12px] font-semibold text-[var(--muted)]">Message preview</div>
              <div className="max-h-[190px] overflow-auto whitespace-pre-wrap rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[13px] text-[13px] leading-[1.55] text-[var(--text)]">
                {message || "Loading template…"}
              </div>
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button
                onClick={() => setOpen(false)}
                className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                Cancel
              </button>
              <a
                href={message ? waUrl : undefined}
                target="_blank"
                rel="noopener"
                aria-disabled={!message}
                title={message ? undefined : "Message still loading…"}
                onClick={(e) => {
                  if (!message) {
                    e.preventDefault();
                    return;
                  }
                  setOpen(false);
                }}
                className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[#25D366] text-[13.5px] font-semibold text-white aria-disabled:pointer-events-none aria-disabled:opacity-60"
              >
                <Icon name="send" size={16} />
                Open WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
