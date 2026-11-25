"use client";

import { ArrowUpRight, Clock } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveWorkOrder } from "@/server/work-order-actions";
import { PRIORITY, WO_BOARD_COLUMNS, WO_STATUS } from "@/lib/constants";
import { Avatar, Badge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

export type BoardOrder = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  assetName: string;
  assetCode: string;
  assigneeName: string | null;
  dueLabel: string | null;
  late: boolean;
};

const columnAccent: Record<string, string> = {
  new: "bg-honey",
  assigned: "bg-[#bdb9af]",
  in_progress: "bg-accent",
  pending_acceptance: "bg-[#d9a441]",
  completed: "bg-mint",
};

export function Kanban({ orders }: { orders: BoardOrder[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [over, setOver] = useState<string | null>(null);

  function drop(status: string, id: string) {
    setOver(null);
    const order = orders.find((o) => o.id === id);
    if (!order || order.status === status) return;
    startTransition(async () => {
      const result = await moveWorkOrder(id, status);
      if (!result.ok) {
        toast.show(result.error ?? "流转失败", "error");
        return;
      }
      toast.show(`已移动到「${WO_STATUS[status]?.label ?? status}」`);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0">
        {WO_BOARD_COLUMNS.map((status) => {
          const items = orders.filter((o) => o.status === status);
          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={() => setOver((v) => (v === status ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) drop(status, id);
              }}
              className={cn(
                "flex min-h-[220px] w-[82vw] shrink-0 snap-start flex-col rounded-2xl border border-transparent bg-ink/[0.025] p-2 transition-colors sm:w-[300px] xl:w-auto",
                over === status && "border-accent/40 bg-accent-soft/40",
              )}
            >
              <header className="mb-2 flex items-center gap-2 px-1.5 py-1">
                <span className={cn("size-1.5 rounded-full", columnAccent[status])} />
                <h3 className="text-[12px] font-semibold">
                  {WO_STATUS[status].label}
                </h3>
                <span className="ml-auto font-mono text-[10px] text-muted">
                  {items.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {items.map((order) => (
                  <article
                    key={order.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", order.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="card group cursor-grab p-3.5 transition-shadow active:cursor-grabbing hover:shadow-[0_10px_30px_-20px_rgba(23,25,28,0.5)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] text-muted">
                        {order.code}
                      </span>
                      <Badge tone={PRIORITY[order.priority].tone}>
                        {PRIORITY[order.priority].label}
                      </Badge>
                    </div>
                    <Link
                      href={`/app/work-orders/${order.id}`}
                      className="mt-2 block text-[12px] font-medium leading-snug text-ink group-hover:text-accent-ink"
                    >
                      {order.title}
                    </Link>
                    <p className="mt-1 truncate text-[10px] text-muted">
                      {order.assetName} · {order.assetCode}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Avatar
                          name={order.assigneeName ?? "待"}
                          size="sm"
                          className={order.assigneeName ? "bg-ink" : "bg-line text-muted"}
                        />
                        <span className="text-[10px] text-muted">
                          {order.assigneeName ?? "待派工"}
                        </span>
                      </span>
                      {order.dueLabel && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[10px]",
                            order.late ? "text-danger" : "text-muted",
                          )}
                        >
                          <Clock className="size-3" />
                          {order.dueLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] text-muted">
                        <span className="sr-only">流转 {order.code} 到</span>
                        <select
                          value={order.status}
                          disabled={pending}
                          onChange={(event) => drop(event.target.value, order.id)}
                          className="h-7 rounded-lg border border-line bg-paper/70 px-1.5 text-[11px] text-ink-soft disabled:opacity-60"
                        >
                          {WO_BOARD_COLUMNS.map((status) => (
                            <option key={status} value={status}>
                              {WO_STATUS[status].label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Link
                        href={`/app/work-orders/${order.id}`}
                        className="flex items-center gap-0.5 text-[10px] text-muted hover:text-ink"
                      >
                        处理 <ArrowUpRight className="size-3" />
                      </Link>
                    </div>
                  </article>
                ))}

                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line/80 px-2 py-6 text-center text-[10px] text-muted/70">
                    {pending ? (
                      "处理中…"
                    ) : (
                      <>
                        <span className="xl:hidden">暂无工单</span>
                        <span className="hidden xl:inline">拖到这里</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted lg:hidden">
        左右滑动查看各阶段 · 卡片底部可直接切换状态
      </p>
    </div>
  );
}
