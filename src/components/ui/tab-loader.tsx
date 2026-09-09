export function TabLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[360px] w-full flex-col items-center justify-center gap-4 py-16">
      <div className="flex items-end gap-[7px]" role="status" aria-label={label ?? "Loading"}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full bg-[var(--brand)]"
            style={{ animation: `tabLoaderBounce 900ms ease-in-out ${i * 120}ms infinite` }}
          />
        ))}
      </div>
      {label && <p className="m-0 text-[13px] font-medium text-[var(--subtle)]">{label}</p>}
    </div>
  );
}
