"use client";

import { ClockCounterClockwise } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ChevronRight } from "@/components/ui";
import { RECENT_REPORTS_KEY, type RecentReport } from "@/lib/repair";
import { fmtDateTime } from "@/lib/utils";

export function RecentReports({ assetToken }: { assetToken: string }) {
  const [items, setItems] = useState<RecentReport[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(RECENT_REPORTS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? (parsed as RecentReport[]) : [];
        setItems(
          list.filter((item) => item.assetToken === assetToken).slice(0, 3),
        );
      } catch {
        // 隐私模式下 localStorage 不可用时直接不展示
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [assetToken]);

  if (items.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <ClockCounterClockwise className="size-4 text-accent" />
          <h2 className="text-[13px] font-semibold">本机最近报修</h2>
        </div>
        <span className="label-mono">{items.length} LOCAL</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.publicToken}>
            <Link
              href={`/t/${item.publicToken}`}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-ink-soft">
                  {item.description}
                </p>
                <p className="mt-0.5 font-mono text-[9px] text-muted">
                  {fmtDateTime(new Date(item.at))}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="px-5 py-3 text-[9px] text-muted">
        仅保存在当前手机浏览器，清理浏览器数据后会消失。
      </p>
    </section>
  );
}
