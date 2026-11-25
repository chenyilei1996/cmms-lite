import { ArrowUpRight, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { assets, users, workOrders } from "@/db/schema";
import { PRIORITY, WO_BOARD_COLUMNS } from "@/lib/constants";
import { fmtDate, isOverdue } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { Kanban, type BoardOrder } from "./kanban";

export const metadata = { title: "工单看板" };

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string }>;
}) {
  const { asset: assetFilter } = await searchParams;

  const rows = await db
    .select({
      id: workOrders.id,
      code: workOrders.code,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      dueAt: workOrders.dueAt,
      createdAt: workOrders.createdAt,
      assetName: assets.name,
      assetCode: assets.code,
      assigneeName: users.name,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(ne(workOrders.status, "cancelled"))
    .orderBy(desc(workOrders.createdAt))
    .limit(200);

  const assetList = await db
    .select({ id: assets.id, code: assets.code, name: assets.name })
    .from(assets)
    .orderBy(assets.code);

  const filtered = assetFilter
    ? rows.filter((r) => r.assetCode === assetFilter)
    : rows;

  const board: BoardOrder[] = filtered
    .filter((r) => (WO_BOARD_COLUMNS as readonly string[]).includes(r.status))
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      status: r.status,
      priority: r.priority,
      assetName: r.assetName,
      assetCode: r.assetCode,
      assigneeName: r.assigneeName,
      dueLabel: r.dueAt ? fmtDate(r.dueAt) : null,
      late: isOverdue(r.dueAt),
    }));

  const closed = filtered.filter((r) => r.status === "closed").slice(0, 6);
  const openCount = board.filter((r) => r.status !== "completed").length;
  const newCount = board.filter((r) => r.status === "new").length;
  const lateCount = board.filter((r) => r.late && r.status !== "completed").length;

  return (
    <>
      <PageHeader
        eyebrow="Maintenance workflow"
        title="工单看板"
        description="从派工到关闭，拖动卡片推进状态。绿色代表已闭环，红色日期表示已逾期。"
        actions={
          <LinkButton href="/app/work-orders/new">
            <Plus className="size-4" /> 新建工单
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">未关闭 {openCount}</Badge>
          <Badge tone="honey">待派工 {newCount}</Badge>
          <Badge tone={lateCount ? "danger" : "mint"}>逾期 {lateCount}</Badge>
        </div>
        <form method="get" className="flex items-center gap-2">
          <select
            name="asset"
            defaultValue={assetFilter ?? ""}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-[12px]"
          >
            <option value="">全部设备</option>
            {assetList.map((item) => (
              <option key={item.id} value={item.code}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 rounded-full bg-ink px-4 text-[11px] font-medium text-white"
          >
            筛选
          </button>
          {assetFilter && (
            <Link
              href="/app/work-orders"
              className="text-[11px] text-muted hover:text-ink"
            >
              清除
            </Link>
          )}
        </form>
      </div>

      {rows.length >= 200 && (
        <p className="mb-3 rounded-xl bg-honey-soft/40 px-3 py-2 text-[11px] text-honey">
          当前仅显示最近 200 条工单，请用上方设备筛选缩小范围。
        </p>
      )}

      <Kanban orders={board} />

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">最近关闭</h2>
          <span className="label-mono">Archive</span>
        </div>
        {closed.length === 0 ? (
          <EmptyState title="还没有已关闭工单" hint="完成验收并归档后会出现在这里。" />
        ) : (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {closed.map((wo) => (
                <li key={wo.id}>
                  <Link
                    href={`/app/work-orders/${wo.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium">{wo.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted">
                        {wo.code} · {wo.assetName}
                      </p>
                    </div>
                    <Badge tone={PRIORITY[wo.priority].tone}>
                      {PRIORITY[wo.priority].label}
                    </Badge>
                    <span className="hidden text-[10px] text-muted sm:block">
                      {fmtDate(wo.createdAt)}
                    </span>
                    <ArrowUpRight className="size-3.5 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
