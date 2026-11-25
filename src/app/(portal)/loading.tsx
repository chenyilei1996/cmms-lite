export default function PortalLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-3 w-24 rounded-full bg-ink/10" />
      <div className="h-8 w-56 rounded-xl bg-ink/10" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card h-28 p-5">
            <div className="h-2.5 w-16 rounded-full bg-ink/10" />
            <div className="mt-6 h-7 w-24 rounded-lg bg-ink/10" />
          </div>
        ))}
      </div>
      <div className="card space-y-3 p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-9 rounded-lg bg-ink/[0.06]" />
        ))}
      </div>
      <span className="sr-only">正在加载</span>
    </div>
  );
}
