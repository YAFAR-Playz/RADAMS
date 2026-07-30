"use client";

import { Icon } from "@/components/icons";

function withAction(href: string, action: "print" | "download" | "share") {
  return `${href}${href.includes("?") ? "&" : "?"}action=${action}`;
}

// Share / Download / Print all open the in-app print view with an ?action=
// hint so the right thing happens immediately there — that page is where the
// actual PDF gets built (via html2canvas/jsPDF, since there's no server-side
// PDF generation), so Share genuinely exports and shares the PDF file
// itself, not a link to this page.
export function ReportActionButtons({ href, disabled, compact }: { href: string; disabled?: boolean; compact?: boolean }) {
  function open(e: React.MouseEvent, action: "print" | "download" | "share") {
    e.stopPropagation();
    if (disabled) return;
    window.open(withAction(href, action), "_blank", "noreferrer");
  }

  const btnClass = compact
    ? "flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
    : "flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60";

  return (
    <div className="flex items-center gap-[6px]">
      <button onClick={(e) => open(e, "share")} disabled={disabled} title="Share" className={btnClass}>
        <Icon name="share" size={compact ? 14 : 16} />
        {!compact && "Share"}
      </button>
      <button onClick={(e) => open(e, "download")} disabled={disabled} title="Download" className={btnClass}>
        <Icon name="download" size={compact ? 14 : 16} />
        {!compact && "Download"}
      </button>
      <button onClick={(e) => open(e, "print")} disabled={disabled} title="Print" className={btnClass}>
        <Icon name="printer" size={compact ? 14 : 16} />
        {!compact && "Print"}
      </button>
    </div>
  );
}
