export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <div className="h-7 w-24 rounded bg-[var(--color-surface-raised)] animate-pulse" />
        <div className="mt-2 h-4 w-48 rounded bg-[var(--color-surface-raised)] animate-pulse" />
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <div className="bg-[var(--color-surface)] p-4 border-b border-[var(--color-border)]">
          <div className="flex gap-8">
            {[160, 80, 60, 120, 60].map((w, i) => (
              <div key={i} className={`h-4 w-${w} rounded bg-[var(--color-surface-raised)] animate-pulse`} />
            ))}
          </div>
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
            <div className="h-4 w-40 rounded bg-[var(--color-surface-raised)] animate-pulse" />
            <div className="h-4 w-20 rounded bg-[var(--color-surface-raised)] animate-pulse" />
            <div className="h-4 w-16 rounded bg-[var(--color-surface-raised)] animate-pulse ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
