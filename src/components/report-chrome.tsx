import { DownloadSimple, Info } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn, fmtDateTime } from "@/lib/utils";
import { REPORT_PERIODS, REPORT_TABS } from "@/lib/reporting";

export function ReportTabs({ active }: { active: string }) {
  return (
    <nav className="no-print mb-4 flex gap-1.5 overflow-x-auto pb-1">
      {REPORT_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[12px] transition-colors",
            active === tab.href
              ? "border-ink bg-ink text-white"
              : "border-line bg-surface text-ink-soft hover:border-ink/25",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

type FilterSelect = {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  allLabel: string;
};

export function ReportFilters({
  basePath,
  days,
  selects = [],
  extra,
}: {
  basePath: string;
  days: number;
  selects?: FilterSelect[];
  extra?: ReactNode;
}) {
  return (
    <form
      method="get"
      action={basePath}
      className="no-print card mb-4 flex flex-col gap-2 p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="block text-[10px] text-muted">
        统计周期
        <select
          name="days"
          defaultValue={String(days)}
          className="mt-1 block h-9 rounded-lg border border-line bg-surface px-3 text-[12px] text-ink-soft"
        >
          {REPORT_PERIODS.map((period) => (
            <option key={period.days} value={period.days}>
              {period.label}
            </option>
          ))}
        </select>
      </label>
      {selects.map((select) => (
        <label key={select.name} className="block text-[10px] text-muted">
          {select.label}
          <select
            name={select.name}
            defaultValue={select.value ?? ""}
            className="mt-1 block h-9 min-w-36 rounded-lg border border-line bg-surface px-3 text-[12px] text-ink-soft"
          >
            <option value="">{select.allLabel}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {extra}
      <div className="flex items-center gap-2 sm:ml-auto">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[12px] font-medium text-white transition-colors hover:bg-ink-soft"
        >
          应用筛选
        </button>
        <Link
          href={basePath}
          className="inline-flex h-9 items-center rounded-full border border-line px-4 text-[12px] text-muted transition-colors hover:border-ink/25 hover:text-ink"
        >
          重置
        </Link>
      </div>
    </form>
  );
}

export function DataCutoff({
  now,
  days,
  extra,
}: {
  now: Date;
  days: number;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
      <span>数据截止 {fmtDateTime(now)}</span>
      <span>·</span>
      <span>统计窗口 {days} 天</span>
      {extra && (
        <>
          <span>·</span>
          <span>{extra}</span>
        </>
      )}
    </div>
  );
}

export function ExportLink({
  report,
  days,
  filters,
}: {
  report: string;
  days: number;
  filters?: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams({ days: String(days) });
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value) params.set(key, value);
  }
  return (
    <a
      href={`/api/export/${report}?${params.toString()}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[11px] text-ink-soft transition-colors hover:border-ink/25"
    >
      <DownloadSimple className="size-3.5" /> 导出 CSV
    </a>
  );
}

export function ReportNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-paper/70 px-4 py-3 text-[10px] leading-relaxed text-muted">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function SampleBadge({ sample, threshold = 5 }: { sample: number; threshold?: number }) {
  if (sample >= threshold) return null;
  return (
    <span className="rounded-full bg-honey-soft px-2 py-0.5 text-[10px] text-honey">
      样本不足（{sample} 次）
    </span>
  );
}
