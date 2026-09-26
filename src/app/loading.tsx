export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded-md bg-ink-100" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-ink-100" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-lg bg-ink-100" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card space-y-3 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded-md bg-ink-100" />
            <div className="h-3 w-1/2 animate-pulse rounded-md bg-ink-100" />
            <div className="h-3 w-1/3 animate-pulse rounded-md bg-ink-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
