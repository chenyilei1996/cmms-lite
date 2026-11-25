export const REPORT_PERIODS = [
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
  { days: 365, label: "近 1 年" },
] as const;

/** 报表统一使用的人工费率（元/小时），可按业务口径调整。 */
export const LABOR_RATE_PER_HOUR = 120;

/** 备件呆滞判定天数。 */
export const SLOW_MOVING_DAYS = 90;

export const REPORT_TABS = [
  { href: "/admin/analytics", label: "总览" },
  { href: "/admin/analytics/work-orders", label: "工单" },
  { href: "/admin/analytics/pm", label: "保养" },
  { href: "/admin/analytics/inspection", label: "点检" },
  { href: "/admin/analytics/spare-parts", label: "备件" },
  { href: "/admin/analytics/cost", label: "成本" },
  { href: "/admin/analytics/faults", label: "故障" },
] as const;

export function resolveDays(value?: string) {
  const matched = REPORT_PERIODS.find((item) => String(item.days) === value);
  return matched ? matched.days : 30;
}

export function periodRange(days: number, now: Date) {
  return { since: new Date(now.getTime() - days * 86400000), now };
}

export function fmtPercent(part: number, total: number, digits = 1) {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(digits)}%`;
}

export function fmtMoney(value: number) {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

export function fmtMoneyExact(value: number) {
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtMinutes(minutes: number) {
  if (!minutes) return "0 分";
  if (minutes < 60) return `${Math.round(minutes)} 分`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

export function fmtHours(hours: number) {
  return `${hours.toLocaleString("zh-CN", {
    maximumFractionDigits: 1,
  })} h`;
}

export type MonthBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

/** 返回最近 count 个自然月，按时间升序。 */
export function monthBuckets(count: number, now: Date): MonthBucket[] {
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(
      now.getFullYear(),
      now.getMonth() - (count - 1 - index),
      1,
    );
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return {
      key: `${start.getFullYear()}-${start.getMonth() + 1}`,
      label: `${start.getMonth() + 1}月`,
      start,
      end,
    };
  });
}

export function inBucket(value: Date | null, bucket: MonthBucket) {
  if (!value) return false;
  return value >= bucket.start && value < bucket.end;
}

export { toCsv } from "./csv";

export function csvFileName(report: string, now: Date) {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `kpi-${report}-${date}.csv`;
}
