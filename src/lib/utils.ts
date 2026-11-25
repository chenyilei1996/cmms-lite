import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { zhCN } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return format(d, "yyyy-MM-dd", { locale: zhCN });
}

export function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return format(d, "MM-dd HH:mm", { locale: zhCN });
}

export function fmtDay(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return isToday(d) ? "今天" : format(d, "MM月dd日", { locale: zhCN });
}

export function timeAgo(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN });
}

export function isOverdue(value: Date | string | null | undefined) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  return d.getTime() < Date.now();
}

export function initials(name: string) {
  return name.slice(0, 1).toUpperCase();
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function makeCode(prefix: string) {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}
