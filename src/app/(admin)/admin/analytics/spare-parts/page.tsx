import { ArrowsClockwise, Package, Wallet, Warning } from "@phosphor-icons/react/dist/ssr";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { assets, inventoryTransactions, spareParts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { SPARE_PART_CATEGORIES, TXN_TYPE } from "@/lib/constants";
import {
  DataCutoff,
  ExportLink,
  ReportFilters,
  ReportNote,
  ReportTabs,
} from "@/components/report-chrome";
import { Badge, Bar, PageHeader, StatCard } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import {
  fmtMoney,
  fmtMoneyExact,
  periodRange,
  resolveDays,
  SLOW_MOVING_DAYS,
} from "@/lib/reporting";

export const metadata = { title: "备件分析" };

export default async function SparePartAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; category?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const days = resolveDays(sp.days);
  const now = new Date();
  const { since } = periodRange(days, now);
  const slowSince = new Date(now.getTime() - SLOW_MOVING_DAYS * 86400000);

  const [partRows, txnRows, machineRows] = await Promise.all([
    db
      .select({
        id: spareParts.id,
        code: spareParts.code,
        name: spareParts.name,
        category: spareParts.category,
        unit: spareParts.unit,
        stockQty: spareParts.stockQty,
        safetyStock: spareParts.safetyStock,
        referencePrice: spareParts.referencePrice,
        active: spareParts.active,
      })
      .from(spareParts)
      .where(eq(spareParts.active, true))
      .orderBy(asc(spareParts.code)),
    db
      .select({
        id: inventoryTransactions.id,
        partId: inventoryTransactions.partId,
        type: inventoryTransactions.type,
        quantity: inventoryTransactions.quantity,
        amount: inventoryTransactions.amount,
        createdAt: inventoryTransactions.createdAt,
        note: inventoryTransactions.note,
        operatorName: inventoryTransactions.operatorName,
        workOrderId: inventoryTransactions.workOrderId,
        partName: spareParts.name,
        partCode: spareParts.code,
        category: spareParts.category,
        unit: spareParts.unit,
      })
      .from(inventoryTransactions)
      .innerJoin(spareParts, eq(inventoryTransactions.partId, spareParts.id))
      .orderBy(desc(inventoryTransactions.createdAt)),
    db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          inArray(assets.level, ["machine", "component"]),
          ne(assets.status, "retired"),
        ),
      ),
  ]);

  const parts = partRows.filter(
    (part) => !sp.category || part.category === sp.category,
  );
  const partIds = new Set(parts.map((part) => part.id));
  const partMap = new Map(parts.map((part) => [part.id, part]));

  const stockValue = parts.reduce(
    (sum, part) => sum + part.stockQty * Number(part.referencePrice ?? 0),
    0,
  );
  const lowStock = parts.filter(
    (part) => part.stockQty < part.safetyStock,
  );

  const periodTxns = txnRows.filter(
    (txn) => partIds.has(txn.partId) && txn.createdAt >= since,
  );
  const outTxns = periodTxns.filter((txn) => txn.type === "out");
  const outAmount = outTxns.reduce(
    (sum, txn) =>
      sum +
      (txn.amount !== null
        ? Number(txn.amount)
        : txn.quantity * Number(partMap.get(txn.partId)?.referencePrice ?? 0)),
    0,
  );
  const outQty = outTxns.reduce((sum, txn) => sum + txn.quantity, 0);
  const turnover = stockValue > 0 ? outAmount / stockValue : null;

  const lastMovement = new Map<string, Date>();
  for (const txn of txnRows) {
    const current = lastMovement.get(txn.partId);
    if (!current || txn.createdAt > current) {
      lastMovement.set(txn.partId, txn.createdAt);
    }
  }
  const slowParts = parts
    .filter((part) => {
      if (part.stockQty <= 0) return false;
      const last = lastMovement.get(part.id);
      return !last || last < slowSince;
    })
    .map((part) => ({
      ...part,
      value: part.stockQty * Number(part.referencePrice ?? 0),
    }))
    .sort((a, b) => b.value - a.value);
  const slowValue = slowParts.reduce((sum, part) => sum + part.value, 0);

  const consumption = new Map<
    string,
    { code: string; name: string; qty: number; amount: number }
  >();
  for (const txn of outTxns) {
    const entry = consumption.get(txn.partId) ?? {
      code: txn.partCode,
      name: txn.partName,
      qty: 0,
      amount: 0,
    };
    entry.qty += txn.quantity;
    entry.amount +=
      txn.amount !== null
        ? Number(txn.amount)
        : txn.quantity * Number(partMap.get(txn.partId)?.referencePrice ?? 0);
    consumption.set(txn.partId, entry);
  }
  const topConsumption = [...consumption.values()]
    .sort((a, b) => b.amount - a.amount || b.qty - a.qty)
    .slice(0, 8);
  const maxConsumption = Math.max(
    ...topConsumption.map((row) => row.amount),
    1,
  );

  return (
    <>
      <PageHeader
        eyebrow="Reports · spare parts"
        title="备件分析"
        description="库存金额、领用消耗、周转率与呆滞清单。数据来自备件台账与库存流水，可直接下钻到备件详情。"
        actions={
          <ExportLink
            report="spare-parts"
            days={days}
            filters={{ category: sp.category }}
          />
        }
      />
      <ReportTabs active="/admin/analytics/spare-parts" />
      <ReportFilters
        basePath="/admin/analytics/spare-parts"
        days={days}
        selects={[
          {
            name: "category",
            label: "备件类别",
            value: sp.category,
            allLabel: "全部类别",
            options: SPARE_PART_CATEGORIES.map((category) => ({
              value: category,
              label: category,
            })),
          },
        ]}
      />
      <DataCutoff
        now={now}
        days={days}
        extra={`${parts.length} 种备件 · ${machineRows.length} 台设备纳入统计`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="库存金额"
          value={fmtMoney(stockValue)}
          tone="mint"
          icon={<Package className="size-4" />}
          sub={`${parts.length} 种在册备件`}
        />
        <StatCard
          label="统计期领用金额"
          value={fmtMoney(outAmount)}
          tone="accent"
          icon={<Wallet className="size-4" />}
          sub={`${outTxns.length} 次 · ${outQty} 件`}
        />
        <StatCard
          label="库存周转率"
          value={turnover === null ? "—" : turnover.toFixed(1)}
          tone="honey"
          icon={<ArrowsClockwise className="size-4" />}
          sub="领用金额 ÷ 当前库存金额"
        />
        <StatCard
          label="呆滞库存"
          value={fmtMoney(slowValue)}
          tone="danger"
          icon={<Package className="size-4" />}
          sub={`${slowParts.length} 种 ${SLOW_MOVING_DAYS} 天无移动`}
        />
        <StatCard
          label="低库存"
          value={lowStock.length}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub="低于安全库存"
        />
        <StatCard
          label="本期退料"
          value={
            periodTxns
              .filter((txn) => txn.type === "return")
              .reduce((sum, txn) => sum + txn.quantity, 0) + " 件"
          }
          tone="neutral"
          icon={<ArrowsClockwise className="size-4" />}
          sub="退料回库数量"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">领用金额 TOP</h2>
            <span className="label-mono">BY COST</span>
          </div>
          {topConsumption.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">
              统计期内没有领用流水。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {topConsumption.map((row) => (
                <li key={row.code} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-[10px] text-muted">
                        {row.code}
                      </span>{" "}
                      <span className="font-medium">{row.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {row.qty} 件 · {fmtMoneyExact(row.amount)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar
                      value={row.amount}
                      total={maxConsumption}
                      tone="accent"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">呆滞清单</h2>
            <span className="label-mono">{SLOW_MOVING_DAYS}D NO MOVE</span>
          </div>
          {slowParts.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">
              当前没有呆滞备件。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {slowParts.slice(0, 10).map((part) => (
                <li
                  key={part.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-[12px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{part.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">
                      {part.code} · 库存 {part.stockQty} {part.unit}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-honey">
                    {fmtMoneyExact(part.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">最近库存流水</h2>
          <span className="label-mono">{periodTxns.length} RECORDS</span>
        </div>
        {periodTxns.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-muted">统计期内没有库存流水。</p>
        ) : (
          <ul className="divide-y divide-line">
            {periodTxns.slice(0, 12).map((txn) => {
              const meta = TXN_TYPE[txn.type];
              return (
                <li
                  key={txn.id}
                  className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium">
                        {txn.partName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                        {txn.partCode} · {fmtDateTime(txn.createdAt)}
                        {txn.operatorName ? ` · ${txn.operatorName}` : ""}
                        {txn.note ? ` · ${txn.note}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-ink-soft">
                    {txn.quantity} {txn.unit}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ReportNote>
        周转率用统计期领用金额 ÷ 当前库存金额近似（系统未保存历史库存快照）；呆滞按 {SLOW_MOVING_DAYS} 天无任何出入库移动且仍有库存计算；领用金额优先取流水金额，缺失时按参考单价估算。
      </ReportNote>
    </>
  );
}
