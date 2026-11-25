"use client";

import { useEffect } from "react";

import { RECENT_REPORTS_KEY, type RecentReport } from "@/lib/repair";

export function RememberReport({
  assetToken,
  publicToken,
  description,
}: {
  assetToken: string;
  publicToken: string;
  description: string;
}) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_REPORTS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? (parsed as RecentReport[]) : [];
      const entry: RecentReport = {
        assetToken,
        publicToken,
        description: description.slice(0, 60),
        at: new Date().getTime(),
      };
      const next = [
        entry,
        ...list.filter((item) => item.publicToken !== publicToken),
      ].slice(0, 10);
      window.localStorage.setItem(RECENT_REPORTS_KEY, JSON.stringify(next));
    } catch {
      // 隐私模式下 localStorage 可能不可用，忽略即可
    }
  }, [assetToken, publicToken, description]);

  return null;
}
