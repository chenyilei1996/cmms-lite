"use client";

import { Check, MagnifyingGlass, Printer } from "@phosphor-icons/react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type QrCard = {
  id: string;
  code: string;
  name: string;
  locationName: string | null;
  qr: string;
};

export function QrSelector({
  cards,
  printTitle = "设备二维码标签",
  printSubtitle = "月立集团设备管理",
  footer = "扫码点检 / 报修 · 设备管理",
  searchPlaceholder = "搜索设备名称、编码或位置",
  emptyText = "没有匹配的设备，换个关键词试试。",
  countUnit = "台",
}: {
  cards: QrCard[];
  printTitle?: string;
  printSubtitle?: string;
  footer?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  countUnit?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(cards.map((card) => card.id)),
  );
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) =>
      [card.name, card.code, card.locationName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [cards, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((card) => next.add(card.id));
      return next;
    });
  }

  return (
    <>
      <div className="no-print card mb-3 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl border border-line bg-paper/60 pl-10 pr-3 text-[13px] placeholder:text-muted/70 focus:border-ink/30 focus:outline-none focus:ring-4 focus:ring-ink/5"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectVisible}
            className="h-9 flex-1 rounded-full border border-line bg-surface px-3 text-[11px] text-ink-soft transition-colors hover:border-ink/25 sm:flex-none"
          >
            全选当前
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="h-9 flex-1 rounded-full border border-line bg-surface px-3 text-[11px] text-muted transition-colors hover:border-ink/25 hover:text-ink sm:flex-none"
          >
            清空
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={selected.size === 0}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[11px] font-medium text-white transition-opacity disabled:opacity-40 sm:flex-none"
          >
            <Printer className="size-3.5" />
            打印 {selected.size} 张
          </button>
        </div>
      </div>

      <p className="no-print mb-4 text-[11px] text-muted">
        已选 {selected.size} / {cards.length} {countUnit}。取消勾选的条目不会出现在打印结果里。
      </p>

      <div className="mb-4 hidden print:block">
        <p className="text-[14px] font-semibold">{printTitle}</p>
        <p className="mt-1 text-[10px] text-muted">
          共 {selected.size} 张 · {printSubtitle}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">
          {emptyText}
        </div>
      ) : (
        <div className="print-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((card) => {
            const isSelected = selected.has(card.id);
            return (
              <button
                type="button"
                key={card.id}
                onClick={() => toggle(card.id)}
                aria-pressed={isSelected}
                className={cn(
                  "print-card card group relative flex flex-col items-center p-4 text-center transition-all",
                  isSelected
                    ? "border-ink/20"
                    : "opacity-45 hover:opacity-80 print:hidden",
                )}
              >
                <span
                  className={cn(
                    "no-print absolute right-2 top-2 flex size-5 items-center justify-center rounded-md border transition-colors",
                    isSelected
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-transparent",
                  )}
                >
                  <Check className="size-3" />
                </span>
                <Image
                  src={card.qr}
                  alt={`${card.name} 二维码`}
                  width={180}
                  height={180}
                  unoptimized
                  className="size-full max-w-[150px]"
                />
                <p className="mt-3 text-[13px] font-semibold leading-tight">
                  {card.name}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted">{card.code}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {card.locationName ?? "未分配位置"}
                </p>
                <p className="mt-2 border-t border-dashed border-line pt-2 text-[9px] tracking-wide text-muted">
                  {footer}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
