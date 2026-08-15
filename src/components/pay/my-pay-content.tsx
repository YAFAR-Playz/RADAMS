"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { getMyPay, getMyReceiptUrl, sendFinanceMessage, markPayViewed, type MyPay } from "@/lib/actions/pay";

function periodLabel(period: string) {
  if (!period) return "";
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmt(n: number, currency: string) {
  const neg = n < 0;
  return `${neg ? "−" : ""}${currency}${Math.abs(n).toLocaleString("en-US")}`;
}

export function MyPayContent() {
  const router = useRouter();
  const [data, setData] = useState<MyPay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [msgOpen, setMsgOpen] = useState(false);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);

  async function onViewReceipt() {
    if (!data) return;
    setReceiptLoading(true);
    try {
      const url = await getMyReceiptUrl(data.period);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("No receipt was attached for this period.");
    } catch {
      setError("Couldn't open the receipt — try again.");
    } finally {
      setReceiptLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setData(await getMyPay());
      } catch {
        setError("Couldn't load your pay — try again.");
      } finally {
        setLoading(false);
      }
    })();
    // Clears the sidebar's "unviewed released pay" dot — router.refresh()
    // re-runs the layout server component so it picks up the new
    // pay_viewed_at without a full page reload.
    markPayViewed().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onChangePeriod(period: string) {
    setLoading(true);
    try {
      setData(await getMyPay(period));
    } catch {
      setError("Couldn't load that period — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onSendMessage() {
    if (!msgBody.trim() || !data) return;
    setSending(true);
    try {
      await sendFinanceMessage(msgBody.trim(), data.period);
      setSent(true);
      setMsgBody("");
      setTimeout(() => {
        setMsgOpen(false);
        setSent(false);
      }, 1200);
    } catch {
      setError("Couldn't send your message — try again.");
    } finally {
      setSending(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonRow className="h-[140px]" />
        <SkeletonRow className="h-[200px]" />
      </div>
    );
  }

  if (!data || data.periods.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[40px_24px] text-center shadow-[var(--shadow)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-[15px] bg-[var(--surface2)] text-[var(--muted)]">
          <Icon name="wallet" size={26} />
        </div>
        <h2 className="m-0 text-[18px] font-semibold text-[var(--text)]">No pay on file yet</h2>
        <p className="m-0 max-w-[380px] text-[13.5px] leading-[1.55] text-[var(--muted)]">
          Finance hasn&apos;t recorded a salary line for you yet. Once they do, your breakdown will appear here.
        </p>
      </div>
    );
  }

  const stats = [
    { value: data.released ? fmt(data.total, data.currency) : "—", label: "Total this month" },
    { value: String(data.courses.length), label: "Courses" },
    { value: data.paid ? "Paid" : "Pending", label: "Payment status" },
  ];

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
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">My pay</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">My salary breakdown</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">How your pay was calculated this month.</p>
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="flex h-10 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
              <Icon name="cal-check" size={15} className="text-[var(--subtle)]" />
              <select
                value={data.period}
                onChange={(e) => onChangePeriod(e.target.value)}
                className="cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
              >
                {data.periods.map((p) => (
                  <option key={p} value={p}>
                    {periodLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setMsgOpen(true)}
              className="flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[14px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]"
            >
              <Icon name="message" size={15} />
              Message Finance
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[13px_15px]">
              <div className="text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--brand)]">{s.value}</div>
              <div className="mt-[3px] text-[12px] font-medium text-[var(--muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonRow className="h-[200px]" />
      ) : data.released ? (
        <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="flex items-center justify-between border-b border-[var(--border2)] p-[15px_18px]">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Breakdown · {periodLabel(data.period)}</h3>
            <div className="flex items-center gap-[8px]">
              {data.paid && (
                <button
                  onClick={onViewReceipt}
                  disabled={receiptLoading}
                  className="flex items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-[7px] text-[12px] font-semibold text-[var(--muted)] disabled:opacity-60"
                >
                  {receiptLoading ? <Spinner size={13} /> : <Icon name="file-up" size={13} />}
                  Receipt
                </button>
              )}
              <span
                className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
                style={data.paid ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--warns)", color: "var(--warn)" }}
              >
                <Icon name={data.paid ? "check2" : "clock"} size={12} />
                {data.paid ? "Paid" : "Pending"}
              </span>
            </div>
          </header>
          <div className="hidden items-center gap-3 border-b border-[var(--border2)] px-[18px] py-[9px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)] md:flex">
            <span className="w-[150px] flex-none">Course</span>
            <span className="w-[92px] flex-none">Method</span>
            <span className="min-w-[110px] flex-1">Basis</span>
            <span className="w-[78px] flex-none text-right">Base</span>
            <span className="w-[64px] flex-none text-right">Bonus</span>
            <span className="w-[72px] flex-none text-right">Deduct.</span>
            <span className="w-[84px] flex-none text-right">Subtotal</span>
          </div>
          {data.courses.map((c, i) => (
            <div key={i} className="border-b border-[var(--border2)] p-[11px_18px]">
              <div className="flex flex-wrap items-center gap-[10px_12px]">
                <span className="w-full flex-none text-[12.5px] font-semibold text-[var(--text)] md:w-[150px]">{c.course}</span>
                <span className="flex-none">
                  <span className="rounded-full bg-[var(--infos)] px-2 py-[2px] text-[11px] font-semibold text-[var(--info)]">{c.method}</span>
                </span>
                <span className="min-w-[110px] flex-1 text-[12.5px] text-[var(--muted)]">{c.basis}</span>
                <span className="w-[78px] flex-none text-right font-mono text-[12.5px] text-[var(--text)]">{fmt(c.base, data.currency)}</span>
                <span className="w-[64px] flex-none text-right font-mono text-[12.5px] text-[var(--ok)]">{c.bonus ? `+${fmt(c.bonus, data.currency)}` : "—"}</span>
                <span className="w-[72px] flex-none text-right font-mono text-[12.5px] text-[var(--danger)]">{c.deduction ? `−${fmt(c.deduction, data.currency)}` : "—"}</span>
                <span className="w-[84px] flex-none text-right font-mono text-[12.5px] font-bold text-[var(--text)]">{fmt(c.subtotal, data.currency)}</span>
              </div>
              {(c.extraItems.length > 0 || c.deductionItems.length > 0 || c.bonusReason || c.deductionReason) && (
                <div className="mt-[7px] flex flex-wrap gap-[6px] pl-[2px]">
                  {c.extraItems.length > 0
                    ? c.extraItems.map((it, j) => (
                        <span
                          key={`extra-${j}`}
                          className="inline-flex items-center gap-[5px] rounded-full bg-[var(--oks)] px-[9px] py-[3px] text-[11px] font-medium text-[var(--ok)]"
                        >
                          <Icon name="trend" size={11} />
                          {[it.category, it.note].filter(Boolean).join(" — ") || "Extra work"} (+{fmt(it.amount, data.currency)})
                        </span>
                      ))
                    : c.bonusReason && (
                        <span className="inline-flex items-center gap-[5px] rounded-full bg-[var(--oks)] px-[9px] py-[3px] text-[11px] font-medium text-[var(--ok)]">
                          <Icon name="trend" size={11} />
                          {c.bonusReason}
                        </span>
                      )}
                  {c.deductionItems.length > 0
                    ? c.deductionItems.map((it, j) => (
                        <span
                          key={`deduction-${j}`}
                          className="inline-flex items-center gap-[5px] rounded-full bg-[var(--dangers)] px-[9px] py-[3px] text-[11px] font-medium text-[var(--danger)]"
                        >
                          <Icon name="minus" size={11} />
                          {[it.category, it.note].filter(Boolean).join(" — ") || "Deduction"} (−{fmt(it.amount, data.currency)})
                        </span>
                      ))
                    : c.deductionReason && (
                        <span className="inline-flex items-center gap-[5px] rounded-full bg-[var(--dangers)] px-[9px] py-[3px] text-[11px] font-medium text-[var(--danger)]">
                          <Icon name="minus" size={11} />
                          {c.deductionReason}
                        </span>
                      )}
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 bg-[var(--surface2)] p-[13px_18px]">
            <span className="text-[12.5px] font-medium text-[var(--muted)]">Paid via {data.payMethod}</span>
            <div className="flex items-center gap-[10px]">
              <span className="text-[13px] text-[var(--muted)]">Total this month</span>
              <span className="font-mono text-[19px] font-bold text-[var(--text)]">{fmt(data.total, data.currency)}</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-[13px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[34px_24px] text-center shadow-[var(--shadow)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-[15px] bg-[var(--warns)] text-[var(--warn)]">
            <Icon name="clock" size={26} />
          </div>
          <div>
            <h2 className="m-0 mb-[6px] text-[18px] font-semibold text-[var(--text)]">
              Your {periodLabel(data.period)} pay hasn&apos;t been released yet
            </h2>
            <p className="m-0 max-w-[380px] text-[13.5px] leading-[1.55] text-[var(--muted)]">
              Finance is still reviewing this month&apos;s adjustments. Your full breakdown will appear here once they
              release it.
            </p>
          </div>
        </section>
      )}

      <div className="flex items-center gap-[11px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--brands)] p-[13px_16px]">
        <Icon name="message" size={18} className="flex-none text-[var(--brand)]" />
        <span className="flex-1 text-[13px] leading-[1.45] text-[var(--text)]">
          Question about your pay or a deduction? <span className="text-[var(--muted)]">Message the Finance team and they&apos;ll review it.</span>
        </span>
        <button onClick={() => setMsgOpen(true)} className="flex-none rounded-[var(--rad-sm)] bg-[var(--brand)] px-[13px] py-2 text-[12.5px] font-semibold text-[var(--brandfg)]">
          Message Finance
        </button>
      </div>

      {/* MESSAGE FINANCE MODAL */}
      {msgOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="message" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Message Finance team</h3>
                <div className="text-[12px] text-[var(--muted)]">Re: {periodLabel(data.period)} pay</div>
              </div>
              <button
                onClick={() => setMsgOpen(false)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="p-[18px]">
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Describe your question for the Finance team…"
                className="h-[120px] w-full resize-none rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-3 text-[13.5px] leading-[1.5] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
              />
            </div>
            <div className="flex gap-[10px] p-[0_18px_16px]">
              <button
                onClick={() => setMsgOpen(false)}
                className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                Cancel
              </button>
              <button
                onClick={onSendMessage}
                disabled={sending || !msgBody.trim() || sent}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-70"
              >
                {sending ? <Spinner size={15} /> : <Icon name={sent ? "check" : "send"} size={15} />}
                {sent ? "Sent" : "Send message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
