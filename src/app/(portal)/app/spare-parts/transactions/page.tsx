import { ArrowLeft, ClockCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryTransactions, spareParts, workOrders } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { TXN_TYPE } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "库存流水" };

export default async function InventoryTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const user = await requireUser();
  const manageable = canManage(user.role);
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const type = sp.type ?? "";

  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(spareParts.name, `%${q}%`),
        ilike(spareParts.code, `%${q}%`),
        ilike(inventoryTransactions.note, `%${q}%`),
      ),
    );
  }
  if (type) conditions.push(eq(inventoryTransactions.type, type as never));

  const [rows, summaryRows] = await Promise.all([
    db
      .select({
        txn: inventoryTransactions,
        partId: spareParts.id,
        partName: spareParts.name,
        partCode: spareParts.code,
        unit: spareParts.unit,
        workOrderCode: workOrders.code,
        workOrderId: workOrders.id,
      })
      .from(inventoryTransactions)
      .innerJoin(spareParts, eq(inventoryTransactions.partId, spareParts.id))
      .leftJoin(workOrders, eq(inventoryTransactions.workOrderId, workOrders.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(150),
    db
      .select({
        type: inventoryTransactions.type,
        n: sql<number>`count(*)`,
        amount: sql<string>`coalesce(sum(${inventoryTransactions.amount}), 0)`,
      })
      .from(inventoryTransactions)
      .groupBy(inventoryTransactions.type),
  ]);

  const summary = Object.fromEntries(
    summaryRows.map((row) => [
      row.type,
      { count: Number(row.n), amount: Number(row.amount) },
    ]),
  ) as Record<string, { count: number; amount: number }>;

  return (
    <>
      <PageHeader
        eyebrow="Inventory ledger"
        title="库存流水"
        description="每一次入库、领用、退料、调拨与盘点调整都会留痕，可追溯到工单与操作人。"
        actions={
          <>
            <LinkButton href="/app/spare-parts" variant="secondary">
              <ArrowLeft className="size-4" /> 返回备件
            </LinkButton>
            {manageable && (
              <LinkButton href="/admin/spare-parts/stocktake" variant="secondary">
                盘点
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(TXN_TYPE).map(([key, meta]) => (
          <div key={key} className="card p-4">
            <p className="text-[11px] text-muted">{meta.label}</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums">
              {summary[key]?.count ?? 0}
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted">
              ¥{(summary[key]?.amount ?? 0).toLocaleString("zh-CN", {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        ))}
      </div>

      <form
        method="get"
        className="card mb-4 flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索备件或流水备注"
            className="h-10 w-full rounded-xl border border-line bg-paper/60 pl-10 pr-3 text-[13px] placeholder:text-muted/70 focus:border-ink/30 focus:outline-none focus:ring-4 focus:ring-ink/5"
          />
        </div>
        <select
          name="type"
          defaultValue={type}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-[12px] text-ink-soft"
        >
          <option value="">全部类型</option>
          {Object.entries(TXN_TYPE).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-full bg-ink px-5 text-[12px] font-medium text-white"
        >
          筛选
        </button>
        {(q || type) && (
          <Link
            href="/app/spare-parts/transactions"
            className="flex h-10 items-center px-2 text-[12px] text-muted hover:text-ink"
          >
            重置
          </Link>
        )}
      </form>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-muted">
          最近 <span className="font-mono text-ink">{rows.length}</span> 条流水
        </p>
        <p className="label-mono hidden sm:block">LEDGER · IMMUTABLE</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClockCounterClockwise className="size-8" />}
          title="没有匹配的流水"
          hint="调整筛选条件，或先做一笔入库/领用。"
        />
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line bg-paper/50">
                  <th className="px-5 py-3 font-medium text-muted">时间</th>
                  <th className="px-4 py-3 font-medium text-muted">类型</th>
                  <th className="px-4 py-3 font-medium text-muted">备件</th>
                  <th className="px-4 py-3 font-medium text-muted">数量</th>
                  <th className="px-4 py-3 font-medium text-muted">金额</th>
                  <th className="px-4 py-3 font-medium text-muted">关联</th>
                  <th className="px-4 py-3 font-medium text-muted">操作人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ txn, partId, partName, partCode, unit, workOrderCode, workOrderId }) => (
                  <tr key={txn.id} className="transition-colors hover:bg-paper/50">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[10px] text-muted">
                      {fmtDateTime(txn.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={TXN_TYPE[txn.type]?.tone ?? "neutral"}>
                        {TXN_TYPE[txn.type]?.label ?? txn.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/spare-parts/${partId}`}
                        className="font-medium text-ink hover:text-accent-ink"
                      >
                        {partName}
                      </Link>
                      <span className="mt-0.5 block font-mono text-[10px] text-muted">
                        {partCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {txn.quantity}
                      <span className="ml-1 text-[10px] text-muted">{unit}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">
                      ¥{Number(txn.amount ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-[11px]">
                      {workOrderId ? (
                        <Link
                          href={`/app/work-orders/${workOrderId}`}
                          className="text-accent-ink hover:underline"
                        >
                          {workOrderCode}
                        </Link>
                      ) : (
                        <span className="text-muted">{txn.note ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted">
                      {txn.operatorName ?? "系统"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {rows.map(({ txn, partId, partName, partCode, unit, workOrderCode, workOrderId }) => (
              <Link
                key={txn.id}
                href={`/app/spare-parts/${partId}`}
                className="card block p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{partName}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">
                      {partCode} · {fmtDateTime(txn.createdAt)}
                    </p>
                  </div>
                  <Badge tone={TXN_TYPE[txn.type]?.tone ?? "neutral"}>
                    {TXN_TYPE[txn.type]?.label ?? txn.type}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="font-mono">
                    {txn.quantity} {unit}
                    {workOrderId ? ` · ${workOrderCode}` : ""}
                  </span>
                  <span className="text-muted">
                    ¥{Number(txn.amount ?? 0).toFixed(2)}
                  </span>
                </div>
                {txn.note && (
                  <p className="mt-2 truncate text-[10px] text-muted">{txn.note}</p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
