export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[20px] border border-[var(--border)] p-[17px_18px] sm:p-[20px_22px]"
      style={{ background: "linear-gradient(135deg, var(--brands) 0%, var(--surface) 60%)" }}
    >
      <div
        className="pointer-events-none absolute -right-[70px] -top-[90px] h-[200px] w-[200px] rounded-full opacity-[0.14] blur-[6px]"
        style={{ background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)" }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">{eyebrow}</div>}
          <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">{title}</h1>
          {subtitle && <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">{subtitle}</p>}
        </div>
        {actions && <div className="flex min-w-0 flex-wrap items-center justify-end gap-[8px]">{actions}</div>}
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}
