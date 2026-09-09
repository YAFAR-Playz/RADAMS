export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,23,41,0.04),0_14px_32px_rgba(16,23,41,0.06)] ${className}`}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand), transparent)" }}
      />
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border2)] px-[18px] py-[15px]">
          <div className="min-w-0">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">{title}</h3>
            {subtitle && <p className="mt-[2px] mb-0 text-[12px] text-[var(--subtle)]">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
