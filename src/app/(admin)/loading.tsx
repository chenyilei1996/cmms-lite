export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-3 w-28 rounded-full bg-ink/10" />
      <div className="h-8 w-64 rounded-xl bg-ink/10" />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card h-72 p-5">
          <div className="h-3 w-24 rounded-full bg-ink/10" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-8 rounded-lg bg-ink/[0.06]" />
            ))}
          </div>
        </div>
        <div className="card h-72 p-5">
          <div className="h-3 w-20 rounded-full bg-ink/10" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 rounded-lg bg-ink/[0.06]" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">正在加载</span>
    </div>
  );
}
