import { ArrowUpRight, CalendarCheck, ClipboardText, Gauge, Package, Path, Pulse, Wallet, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, count, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  downtimeRecords,
  inspectionRunItems,
  inspectionRuns,
  inspectionTasks,
  spareParts,
  workOrderParts,
  workOrders,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import {
  DataCutoff,
  ExportLink,
  ReportFilters,
  ReportNote,
  ReportTabs,
} from "@/components/report-chrome";
import { PageHeader, StatCard } from "@/components/ui";
import {
  fmtHours,
  fmtMinutes,
  fmtMoney,
  fmtPercent,
  inBucket,
  LABOR_RATE_PER_HOUR,
  monthBuckets,
  periodRange,
  resolveDays,
} from "@/lib/reporting";

export const metadata = { title: "报表与 KPI" };

const OPEN_STATUS = ["new", "assigned", "in_progress", "pending_acceptance"] as const;

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);
  const days = resolveDays(sp.days);
  const now = new Date();
  const { since } = periodRange(days, now);
  const trendStart = monthBuckets(6, now)[0].start;

  const [woRows, downtimeRows, taskRows, runRows, partRows, machineRows, costPartRows, anomalyRows] =
    await Promise.all([
      db.select().from(workOrders),
      db
        .select()
        .from(downtimeRecords)
        .where(gte(downtimeRecords.startedAt, trendStart)),
      db
        .select({
          id: inspectionTasks.id,
          status: inspectionTasks.status,
          dueAt: inspectionTasks.dueAt,
          completedAt: inspectionTasks.completedAt,
        })
        .from(inspectionTasks)
        .where(gte(inspectionTasks.dueAt, since)),
      db
        .select({
          id: inspectionRuns.id,
          status: inspectionRuns.status,
          dueAt: inspectionRuns.dueAt,
          completedAt: inspectionRuns.completedAt,
        })
        .from(inspectionRuns)
        .where(gte(inspectionRuns.dueAt, since)),
      db
        .select({
          stockQty: spareParts.stockQty,
          safetyStock: spareParts.safetyStock,
          referencePrice: spareParts.referencePrice,
          active: spareParts.active,
        })
        .from(spareParts),
      db
        .select({ n: count() })
        .from(assets)
        .where(
          and(
            inArray(assets.level, ["machine", "component"]),
            ne(assets.status, "retired"),
          ),
        ),
      db
        .select({
          workOrderId: workOrderParts.workOrderId,
          quantity: workOrderParts.quantity,
          unitPrice: workOrderParts.unitPrice,
          amount: workOrderParts.amount,
        })
        .from(workOrderParts),
      db
        .select({ n: count() })
        .from(inspectionRunItems)
        .innerJoin(inspectionRuns, eq(inspectionRunItems.runId, inspectionRuns.id))
        .where(
          and(
            eq(inspectionRunItems.status, "abnormal"),
            gte(inspectionRuns.dueAt, since),
          ),
        ),
    ]);

  const createdWo = woRows.filter((wo) => wo.createdAt >= since);
  const closedWo = woRows.filter(
    (wo) =>
      (wo.status === "completed" || wo.status === "closed") &&
      (wo.closedAt ?? wo.completedAt ?? wo.createdAt) >= since,
  );
  const timelyWo = closedWo.filter(
    (wo) =>
      wo.dueAt && (wo.closedAt ?? wo.completedAt)! <= wo.dueAt,
  );
  const openWo = woRows.filter((wo) =>
    (OPEN_STATUS as readonly string[]).includes(wo.status),
  );

  const periodDowntime = downtimeRows.filter((row) => row.startedAt >= since);
  const unplanned = periodDowntime.filter((row) => row.type === "unplanned");
  const unplannedMinutes = unplanned.reduce((sum, row) => sum + row.minutes, 0);
  const totalDowntimeMinutes = periodDowntime.reduce(
    (sum, row) => sum + row.minutes,
    0,
  );
  const machineCount = Math.max(1, Number(machineRows[0]?.n ?? 1));
  const availableMinutes = days * 24 * 60 * machineCount;
  const mttr = unplanned.length ? unplannedMinutes / unplanned.length : null;
  const mtbfHours = unplanned.length
    ? Math.max(0, availableMinutes - totalDowntimeMinutes) /
      unplanned.length /
      60
    : null;
  const availability = availableMinutes
    ? (availableMinutes - unplannedMinutes) / availableMinutes
    : null;

  const dueTasks = taskRows.filter((task) => task.dueAt <= now);
  const doneTasks = dueTasks.filter((task) => task.status === "done");
  const onTimeTasks = doneTasks.filter(
    (task) => task.completedAt && task.completedAt <= task.dueAt,
  );

  const dueRuns = runRows.filter((run) => run.dueAt <= now);
  const doneRuns = dueRuns.filter((run) => run.status === "done");
  const missedRuns = dueRuns.filter((run) => run.status === "missed");

  const closedIds = new Set(closedWo.map((wo) => wo.id));
  let partsCost = 0;
  let incompleteCost = 0;
  for (const wo of closedWo) {
    if (wo.laborMinutes === null) incompleteCost += 1;
  }
  for (const part of costPartRows) {
    if (!closedIds.has(part.workOrderId)) continue;
    const amount =
      part.amount !== null
        ? Number(part.amount)
        : part.unitPrice !== null
          ? Number(part.unitPrice) * part.quantity
          : null;
    if (amount === null) {
      incompleteCost += 1;
    } else {
      partsCost += amount;
    }
  }
  const laborCost =
    (closedWo.reduce((sum, wo) => sum + (wo.laborMinutes ?? 0), 0) /
      60) *
    LABOR_RATE_PER_HOUR;
  const totalCost = laborCost + partsCost;

  const stockValue = partRows.reduce(
    (sum, part) =>
      sum + part.stockQty * Number(part.referencePrice ?? 0),
    0,
  );
  const lowStock = partRows.filter(
    (part) => part.active && part.stockQty < part.safetyStock,
  ).length;
  const anomalyCount = Number(anomalyRows[0]?.n ?? 0);

  const buckets = monthBuckets(6, now).map((bucket) => ({
    ...bucket,
    created: woRows.filter((wo) => inBucket(wo.createdAt, bucket)).length,
    closed: woRows.filter(
      (wo) =>
        (wo.status === "completed" || wo.status === "closed") &&
        inBucket(wo.closedAt ?? wo.completedAt, bucket),
    ).length,
    downtime: downtimeRows
      .filter((row) => inBucket(row.startedAt, bucket))
      .reduce((sum, row) => sum + row.minutes, 0),
  }));
  const maxBar = Math.max(
    ...buckets.map((bucket) => Math.max(bucket.created, bucket.closed)),
    1,
  );

  const reportCards = [
    {
      href: "/admin/analytics/work-orders",
      title: "工单分析",
      value: `${closedWo.length} 张关闭`,
      hint: `及时率 ${fmtPercent(timelyWo.length, closedWo.length)} · 积压 ${openWo.length} 张`,
    },
    {
      href: "/admin/analytics/pm",
      title: "保养分析",
      value: `${doneTasks.length}/${dueTasks.length}`,
      hint: `按期率 ${fmtPercent(onTimeTasks.length, dueTasks.length)}`,
    },
    {
      href: "/admin/analytics/inspection",
      title: "点检分析",
      value: `${doneRuns.length}/${dueRuns.length}`,
      hint: `漏检 ${missedRuns.length} 条 · 异常项 ${anomalyCount} 个`,
    },
    {
      href: "/admin/analytics/spare-parts",
      title: "备件分析",
      value: fmtMoney(stockValue),
      hint: `${lowStock} 种低库存 · 呆滞与消耗见明细`,
    },
    {
      href: "/admin/analytics/cost",
      title: "成本分析",
      value: manageable ? fmtMoney(totalCost) : "—",
      hint: manageable ? `人工 ${fmtMoney(laborCost)} · 备件 ${fmtMoney(partsCost)}` : "成本明细需管理权限",
    },
    {
      href: "/admin/analytics/faults",
      title: "故障分析",
      value: `${unplanned.length} 次故障`,
      hint: `MTTR ${mttr === null ? "—" : fmtMinutes(mttr)} · MTBF ${mtbfHours === null ? "—" : fmtHours(mtbfHours)}`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Reports · KPI"
        title="报表与 KPI"
        description="从同一套工单、点检、备件与停机数据计算管理指标，支持周期与对象筛选，所有数字都能下钻到明细。"
        actions={
          <ExportLink report="overview" days={days} />
        }
      />
      <ReportTabs active="/admin/analytics" />
      <ReportFilters basePath="/admin/analytics" days={days} />
      <DataCutoff
        now={now}
        days={days}
        extra={`统计期内新建工单 ${createdWo.length} 张 · 未关闭 ${openWo.length} 张`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="工单及时率"
          value={fmtPercent(timelyWo.length, closedWo.length)}
          tone="mint"
          icon={<ClipboardText className="size-4" />}
          sub={`${timelyWo.length}/${closedWo.length} 张按期关闭`}
        />
        <StatCard
          label="PM 按期率"
          value={fmtPercent(onTimeTasks.length, dueTasks.length)}
          tone="accent"
          icon={<CalendarCheck className="size-4" />}
          sub={`${doneTasks.length} 已完成 / ${dueTasks.length} 到期`}
        />
        <StatCard
          label="点检完成率"
          value={fmtPercent(doneRuns.length, dueRuns.length)}
          tone="honey"
          icon={<Path className="size-4" />}
          sub={`漏检 ${missedRuns.length} 条 · 异常项 ${anomalyCount} 个`}
        />
        <StatCard
          label="MTTR"
          value={mttr === null ? "—" : fmtMinutes(mttr)}
          tone="danger"
          icon={<Wrench className="size-4" />}
          sub={`非计划停机 ${unplanned.length} 次`}
        />
        <StatCard
          label="MTBF"
          value={mtbfHours === null ? "—" : fmtHours(mtbfHours)}
          tone="neutral"
          icon={<Gauge className="size-4" />}
          sub={`${machineCount} 台设备折算`}
        />
        <StatCard
          label="设备可用率"
          value={availability === null ? "—" : `${(availability * 100).toFixed(1)}%`}
          tone="mint"
          icon={<Pulse className="size-4" />}
          sub="按日历可用时间近似"
        />
        <StatCard
          label="维修成本"
          value={manageable ? fmtMoney(totalCost) : "—"}
          tone="honey"
          icon={<Wallet className="size-4" />}
          sub={
            manageable
              ? `人工 ${fmtMoney(laborCost)} · 备件 ${fmtMoney(partsCost)}${incompleteCost ? ` · ${incompleteCost} 项不完整` : ""}`
              : "成本明细需管理权限"
          }
        />
        <StatCard
          label="库存金额"
          value={fmtMoney(stockValue)}
          tone="accent"
          icon={<Package className="size-4" />}
          sub={`${lowStock} 种低于安全库存`}
        />
      </div>

      <section className="card mt-4 p-5 lg:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold">近 6 个月工单与停机</h2>
          <span className="label-mono">CREATED / CLOSED / MINUTES</span>
        </div>
        <div className="flex h-44 items-end gap-2 sm:gap-4">
          {buckets.map((bucket) => (
            <div key={bucket.key} className="group flex flex-1 flex-col items-center gap-1">
              <div className="flex h-full w-full items-end justify-center gap-1">
                <div
                  className="w-1/3 rounded-t-md bg-accent/70"
                  title={`新建 ${bucket.created} 张`}
                  style={{
                    height: `${Math.max(bucket.created ? 6 : 2, (bucket.created / maxBar) * 100)}%`,
                  }}
                />
                <div
                  className="w-1/3 rounded-t-md bg-mint/80"
                  title={`关闭 ${bucket.closed} 张`}
                  style={{
                    height: `${Math.max(bucket.closed ? 6 : 2, (bucket.closed / maxBar) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-muted">{bucket.label}</span>
              <span className="font-mono text-[9px] text-muted opacity-70">
                {Math.round(bucket.downtime / 60)}h
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent/70" /> 新建工单
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-mint/80" /> 关闭工单
          </span>
          <span>柱下数字为当月停机小时</span>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card group flex items-center justify-between gap-3 p-5 transition-colors hover:border-ink/25"
          >
            <div>
              <p className="text-[13px] font-semibold">{card.title}</p>
              <p className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em] tabular-nums">
                {card.value}
              </p>
              <p className="mt-1 text-[10px] text-muted">{card.hint}</p>
            </div>
            <ArrowUpRight className="size-4 text-muted transition-colors group-hover:text-ink" />
          </Link>
        ))}
      </div>

      <ReportNote>
        口径说明：工单及时率按统计期内关闭且未超过期望完成的工单计算；PM 按期率按统计期内到期任务计算；MTTR 为非计划停机总时长 ÷ 非计划停机次数；MTBF 按周期可用分钟扣除停机后除以非计划故障次数；可用率按日历时间近似（无生产日历）。成本人工按 {LABOR_RATE_PER_HOUR} 元/小时估算，备件按工单领用金额归集。导出 CSV 会记录操作人与范围到审计日志。
      </ReportNote>
    </>
  );
}
