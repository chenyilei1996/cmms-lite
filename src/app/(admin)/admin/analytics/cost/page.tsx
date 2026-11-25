import { Lock, Wallet } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, asc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { assets, workOrderParts, workOrders } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
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
  fmtMinutes,
  fmtMoney,
  fmtMoneyExact,
  inBucket,
  LABOR_RATE_PER_HOUR,
  monthBuckets,
  periodRange,
  resolveDays,
} from "@/lib/reporting";

export const metadata = { title: "成本分析" };

function partAmount(part: {
  amount: string | null;
  unitPrice: string | null;
  quantity: number;
}) {
  if (part.amount !== null) return Number(part.amount);
  if (part.unitPrice !== null) return Number(part.unitPrice) * part.quantity;
  return null;
}

export default async function CostAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; asset?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const days = resolveDays(sp.days);
  const now = new Date();
  const { since } = periodRange(days, now);
  const trendStart = monthBuckets(6, now)[0].start;

  const [assetRows] = await Promise.all([
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .where(
        and(
          inArray(assets.level, ["machine", "component"]),
          ne(assets.status, "retired"),
        ),
      )
      .orderBy(asc(assets.code)),
  ]);

  if (!canManage(user.role)) {
    return (
      <>
        <PageHeader
          eyebrow="Reports · cost"
          title="成本分析"
          description="人工、备件与维修成本按设备汇总。成本明细涉及敏感数据，仅管理员与维修主管可查看。"
        />
        <ReportTabs active="/admin/analytics/cost" />
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-honey-soft text-honey">
            <Lock className="size-5" />
          </span>
          <p className="mt-4 text-[13px] font-medium">需要成本查看权限</p>
          <p className="mt-1 max-w-sm text-[12px] text-muted">
            当前角色为只读或维修执行角色。成本明细、供应商价格与导出需管理员或维修主管授权。
          </p>
        </div>
      </>
    );
  }

  const [woRows, partRows] = await Promise.all([
    db.select().from(workOrders),
    db
      .select({
        workOrderId: workOrderParts.workOrderId,
        quantity: workOrderParts.quantity,
        unitPrice: workOrderParts.unitPrice,
        amount: workOrderParts.amount,
      })
      .from(workOrderParts),
  ]);

  const partsByWo = new Map<string, typeof partRows>();
  for (const part of partRows) {
    const list = partsByWo.get(part.workOrderId) ?? [];
    list.push(part);
    partsByWo.set(part.workOrderId, list);
  }

  const finished = woRows.filter(
    (wo) =>
      (wo.status === "completed" || wo.status === "closed") &&
      (wo.closedAt ?? wo.completedAt ?? wo.createdAt) >= since &&
      (!sp.asset || wo.assetId === sp.asset),
  );

  const costRows = finished.map((wo) => {
    const parts = partsByWo.get(wo.id) ?? [];
    let woPartsCost = 0;
    let woIncomplete = wo.laborMinutes === null;
    for (const part of parts) {
      const amount = partAmount(part);
      if (amount === null) woIncomplete = true;
      else woPartsCost += amount;
    }
    const woLaborCost = ((wo.laborMinutes ?? 0) / 60) * LABOR_RATE_PER_HOUR;
    return {
      wo,
      laborMinutes: wo.laborMinutes,
      laborCost: woLaborCost,
      partsCost: woPartsCost,
      total: woLaborCost + woPartsCost,
      incomplete: woIncomplete,
    };
  });
  const laborCost = costRows.reduce((sum, row) => sum + row.laborCost, 0);
  const partsCost = costRows.reduce((sum, row) => sum + row.partsCost, 0);
  const incomplete = costRows.filter((row) => row.incomplete).length;
  const totalCost = laborCost + partsCost;
  const avgCost = finished.length ? totalCost / finished.length : null;
  const detailRows = [...costRows].sort((a, b) => b.total - a.total);
  const maxCost = Math.max(...detailRows.map((row) => row.total), 1);

  const trendWo = woRows.filter((wo) => {
    if (wo.status !== "completed" && wo.status !== "closed") return false;
    const at = wo.closedAt ?? wo.completedAt;
    if (!at || at < trendStart) return false;
    if (sp.asset && wo.assetId !== sp.asset) return false;
    return true;
  });
  const buckets = monthBuckets(6, now).map((bucket) => {
    let labor = 0;
    let parts = 0;
    for (const wo of trendWo) {
      if (!inBucket(wo.closedAt ?? wo.completedAt, bucket)) continue;
      labor += ((wo.laborMinutes ?? 0) / 60) * LABOR_RATE_PER_HOUR;
      for (const part of partsByWo.get(wo.id) ?? []) {
        parts += partAmount(part) ?? 0;
      }
    }
    return { ...bucket, labor, parts };
  });
  const maxMonthly = Math.max(
    ...buckets.map((bucket) => bucket.labor + bucket.parts),
    1,
  );

  const assetStats = new Map<
    string,
    { name: string; labor: number; parts: number; total: number }
  >();
  for (const row of costRows) {
    const entry = assetStats.get(row.wo.assetId) ?? {
      name: assetRows.find((asset) => asset.id === row.wo.assetId)?.name ?? "未知设备",
      labor: 0,
      parts: 0,
      total: 0,
    };
    entry.labor += row.laborCost;
    entry.parts += row.partsCost;
    entry.total += row.total;
    assetStats.set(row.wo.assetId, entry);
  }
  const topAssets = [...assetStats.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return (
    <>
      <PageHeader
        eyebrow="Reports · cost"
        title="成本分析"
        description={`人工按 ${LABOR_RATE_PER_HOUR} 元/小时估算，备件按工单领用金额归集。缺失工时或单价的工单会标记“成本不完整”，不按 0 处理。`}
        actions={
          <ExportLink report="cost" days={days} filters={{ asset: sp.asset }} />
        }
      />
      <ReportTabs active="/admin/analytics/cost" />
      <ReportFilters
        basePath="/admin/analytics/cost"
        days={days}
        selects={[
          {
            name: "asset",
            label: "设备",
            value: sp.asset,
            allLabel: "全部设备",
            options: assetRows.map((row) => ({
              value: row.id,
              label: `${row.code} · ${row.name}`,
            })),
          },
        ]}
      />
      <DataCutoff
        now={now}
        days={days}
        extra={`${finished.length} 张已关闭工单 · ${incomplete} 张成本不完整`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="维修总成本"
          value={fmtMoney(totalCost)}
          tone="honey"
          icon={<Wallet className="size-4" />}
          sub={`${finished.length} 张工单`}
        />
        <StatCard
          label="人工成本"
          value={fmtMoney(laborCost)}
          tone="accent"
          sub={`${LABOR_RATE_PER_HOUR} 元/小时`}
        />
        <StatCard
          label="备件成本"
          value={fmtMoney(partsCost)}
          tone="mint"
          sub="按领用金额归集"
        />
        <StatCard
          label="单均成本"
          value={avgCost === null ? "—" : fmtMoney(avgCost)}
          tone="neutral"
          sub={incomplete ? `${incomplete} 张数据不完整` : "数据完整"}
        />
      </div>

      <section className="card mt-4 p-5 lg:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold">近 6 个月成本结构</h2>
          <span className="label-mono">LABOR / PARTS</span>
        </div>
        <div className="flex h-44 items-end gap-2 sm:gap-4">
          {buckets.map((bucket) => {
            const total = bucket.labor + bucket.parts;
            return (
              <div key={bucket.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-mono text-[9px] text-muted">
                  {total ? fmtMoney(total) : "—"}
                </span>
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className="flex w-2/3 flex-col justify-end overflow-hidden rounded-t-md"
                    style={{ height: `${Math.max(total ? 6 : 2, (total / maxMonthly) * 100)}%` }}
                  >
                    <div
                      className="w-full bg-accent/80"
                      style={{
                        height: `${total ? (bucket.labor / total) * 100 : 0}%`,
                      }}
                      title={`人工 ${fmtMoney(bucket.labor)}`}
                    />
                    <div
                      className="w-full bg-mint/80"
                      style={{
                        height: `${total ? (bucket.parts / total) * 100 : 0}%`,
                      }}
                      title={`备件 ${fmtMoney(bucket.parts)}`}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted">{bucket.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent/80" /> 人工
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-mint/80" /> 备件
          </span>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">工单成本明细</h2>
            <span className="label-mono">{detailRows.length} ORDERS</span>
          </div>
          {detailRows.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">
              统计期内没有已关闭工单。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {detailRows.slice(0, 12).map((row) => (
                <li key={row.wo.id}>
                  <Link
                    href={`/app/work-orders/${row.wo.id}`}
                    className="block px-5 py-3 transition-colors hover:bg-paper/60"
                  >
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="min-w-0 truncate font-medium">
                        {row.wo.title}
                      </span>
                      <span className="shrink-0 font-mono">
                        {fmtMoneyExact(row.total)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                      <span>{row.wo.code}</span>
                      <span>
                        {assetRows.find((asset) => asset.id === row.wo.assetId)?.name ??
                          "未知设备"}
                      </span>
                      <span>{fmtDateTime(row.wo.closedAt ?? row.wo.completedAt)}</span>
                      <span>
                        人工 {row.laborMinutes === null ? "缺失" : fmtMinutes(row.laborMinutes)} ·{" "}
                        {fmtMoney(row.laborCost)}
                      </span>
                      <span>备件 {fmtMoney(row.partsCost)}</span>
                      {row.incomplete && (
                        <Badge tone="honey">成本不完整</Badge>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <Bar value={row.total} total={maxCost} tone="honey" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">设备成本 TOP</h2>
            <span className="label-mono">BY ASSET</span>
          </div>
          {topAssets.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">暂无数据。</p>
          ) : (
            <ul className="divide-y divide-line">
              {topAssets.map((asset) => (
                <li key={asset.name} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate font-medium">{asset.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {fmtMoney(asset.total)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted">
                    人工 {fmtMoney(asset.labor)} · 备件 {fmtMoney(asset.parts)}
                  </p>
                  <div className="mt-1.5">
                    <Bar value={asset.total} total={topAssets[0].total} tone="accent" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ReportNote>
        成本 = 人工 + 备件；人工 = 工单工时 ÷ 60 × {LABOR_RATE_PER_HOUR}；备件取工单领用明细金额。未填工时或备件无单价时标记“成本不完整”，不默认为 0。外委费用尚未纳入数据模型，当前不计入。
      </ReportNote>
    </>
  );
}
