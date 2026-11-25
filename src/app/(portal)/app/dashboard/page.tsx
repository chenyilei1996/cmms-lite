import { ArrowUpRight, Bell, CalendarDots, ChartBar, ClipboardText, Cube, Plus, Tray, Warning, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inspectionRunItems,
  inspectionTasks,
  pdmAlarms,
  pdmSuggestedWorkOrders,
  repairRequests,
  spareParts,
  users,
  workOrders,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { ASSET_STATUS, TASK_STATUS, WO_STATUS } from "@/lib/constants";
import { fmtDateTime, fmtDay, isOverdue } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Bar,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/ui";

export const metadata = { title: "总览" };

const assetOrder = [
  "in_service",
  "idle",
  "fault",
  "repairing",
  "maintenance",
  "stopped",
  "retired",
];
const woOrder = ["new", "assigned", "in_progress", "pending_acceptance", "completed", "closed"];

const barTone: Record<string, "accent" | "mint" | "honey" | "ink"> = {
  in_service: "mint",
  idle: "mint",
  fault: "accent",
  repairing: "accent",
  maintenance: "honey",
  stopped: "ink",
  retired: "ink",
};

const assetColors: Record<string, string> = {
  in_service: "bg-mint",
  idle: "bg-[#bdb9af]",
  fault: "bg-danger",
  repairing: "bg-accent",
  maintenance: "bg-[#d9a441]",
  stopped: "bg-[#77736a]",
  retired: "bg-ink/40",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const manageable = canManage(user.role);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [
    assetRows,
    woCounts,
    taskRows,
    recentWo,
    requestCount,
    lowStockRows,
    alarmRows,
    pendingSuggestionRows,
    abnormalRows,
  ] =
    await Promise.all([
      db
        .select({ status: assets.status, criticality: assets.criticality })
        .from(assets)
        .where(eq(assets.level, "machine")),
      db
        .select({ status: workOrders.status, n: count() })
        .from(workOrders)
        .groupBy(workOrders.status),
      db
        .select({
          id: inspectionTasks.id,
          dueAt: inspectionTasks.dueAt,
          status: inspectionTasks.status,
          type: inspectionTasks.type,
          assetName: assets.name,
          assetCode: assets.code,
        })
        .from(inspectionTasks)
        .innerJoin(assets, eq(inspectionTasks.assetId, assets.id))
        .where(inArray(inspectionTasks.status, ["pending"]))
        .orderBy(inspectionTasks.dueAt),
      db
        .select({
          id: workOrders.id,
          code: workOrders.code,
          title: workOrders.title,
          status: workOrders.status,
          priority: workOrders.priority,
          createdAt: workOrders.createdAt,
          assetName: assets.name,
          assigneeName: users.name,
        })
        .from(workOrders)
        .innerJoin(assets, eq(workOrders.assetId, assets.id))
        .leftJoin(users, eq(workOrders.assigneeId, users.id))
        .orderBy(desc(workOrders.createdAt))
        .limit(6),
      db
        .select({ n: count() })
        .from(repairRequests)
        .where(gte(repairRequests.createdAt, monthAgo)),
      db
        .select({ n: count() })
        .from(spareParts)
        .where(
          and(
            eq(spareParts.active, true),
            sql`${spareParts.stockQty} < ${spareParts.safetyStock}`,
          ),
        ),
      db
        .select({ severity: pdmAlarms.severity })
        .from(pdmAlarms)
        .where(inArray(pdmAlarms.status, ["open", "acknowledged"])),
      db
        .select({ n: count() })
        .from(pdmSuggestedWorkOrders)
        .where(eq(pdmSuggestedWorkOrders.status, "pending")),
      db
        .select({ n: count() })
        .from(inspectionRunItems)
        .where(
          and(
            eq(inspectionRunItems.status, "abnormal"),
            gte(inspectionRunItems.createdAt, weekAgo),
          ),
        ),
    ]);

  const lowStockCount = Number(lowStockRows[0]?.n ?? 0);
  const openAlarmCount = alarmRows.length;
  const criticalAlarmCount = alarmRows.filter(
    (row) => row.severity === "critical",
  ).length;
  const pendingSuggestionCount = Number(pendingSuggestionRows[0]?.n ?? 0);
  const abnormalWeekCount = Number(abnormalRows[0]?.n ?? 0);
  const alertTotal =
    openAlarmCount + pendingSuggestionCount + abnormalWeekCount;

  const assetCounts = assetOrder.reduce<Record<string, number>>((acc, key) => {
    acc[key] = assetRows.filter((a) => a.status === key).length;
    return acc;
  }, {});
  const assetTotal = assetRows.length;
  const criticalA = assetRows.filter((a) => a.criticality === "A").length;

  const woCountMap = woOrder.reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
  for (const row of woCounts) woCountMap[row.status] = Number(row.n);
  const openWo =
    woCountMap.new +
    woCountMap.assigned +
    woCountMap.in_progress +
    woCountMap.pending_acceptance;
  const overdueTasks = taskRows.filter(
    (t) => t.status === "pending" && t.dueAt < startOfToday,
  );
  const todayTasks = taskRows.filter(
    (t) => t.status === "pending" && t.dueAt >= startOfToday && t.dueAt < endOfToday,
  );

  return (
    <>
      <PageHeader
        eyebrow={`${fmtDay(now)} · ${now.toLocaleDateString("zh-CN", { weekday: "long" })}`}
        title="设备运行总览"
        description="从报修到关闭的每条链路，都在这里汇总。逾期、待派工和今日保养会优先浮到上面。"
        actions={
          <>
            {manageable && (
              <LinkButton href="/admin/analytics" variant="secondary">
                <ChartBar className="size-4" /> 报表与 KPI
              </LinkButton>
            )}
            <LinkButton href="/app/assets" variant="secondary">
              <Cube className="size-4" /> 设备台账
            </LinkButton>
            <LinkButton href="/app/work-orders/new">
              <Plus className="size-4" /> 新建工单
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="设备总数"
          value={assetTotal}
          tone="mint"
          icon={<Cube className="size-4" />}
          sub={
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-mint" />
              {assetCounts.in_service} 台运行中
            </span>
          }
          className="rise rise-1"
        />
        <StatCard
          label="未关闭工单"
          value={openWo}
          tone="accent"
          icon={<ClipboardText className="size-4" />}
          sub={`${woCountMap.new} 张待派工 · ${woCountMap.in_progress} 张处理中`}
          className="rise rise-2"
        />
        <StatCard
          label="逾期保养"
          value={overdueTasks.length}
          tone="honey"
          icon={<CalendarDots className="size-4" />}
          sub={`今日到期 ${todayTasks.length} 项`}
          className="rise rise-3"
        />
        <StatCard
          label="近 30 天报修"
          value={Number(requestCount[0]?.n ?? 0)}
          tone="neutral"
          icon={<Tray className="size-4" />}
          sub="含扫码与内部代报"
          className="rise rise-4"
        />
      </div>

      {lowStockCount > 0 && (
        <Link
          href="/app/spare-parts?low=1"
          className="card mt-4 flex items-center justify-between gap-3 border-honey/30 bg-honey-soft/40 px-5 py-3.5 transition-colors hover:border-honey/60"
        >
          <span className="text-[12px] text-ink-soft">
            <span className="font-medium text-honey">{lowStockCount} 种备件</span>{" "}
            低于安全库存，建议补货。
          </span>
          <span className="text-[11px] text-muted">去备件台账 →</span>
        </Link>
      )}

      <section className="card mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold">预警与待处理</h2>
            {alertTotal > 0 && (
              <Badge tone={criticalAlarmCount > 0 ? "danger" : "honey"}>
                {alertTotal} 项待处理
              </Badge>
            )}
          </div>
          <span className="label-mono">
            {alertTotal > 0 ? "NEED ATTENTION" : "ALL CLEAR"}
          </span>
        </div>
        <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Link
            href="/app/pdm/alarms"
            className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-paper/60"
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                criticalAlarmCount > 0
                  ? "bg-danger-soft text-danger"
                  : "bg-honey-soft/60 text-honey"
              }`}
            >
              <Bell className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">PDM 未关闭报警</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-[20px] leading-none tabular-nums">
                  {openAlarmCount}
                </span>
                <span className="text-[10px] text-muted">条</span>
              </p>
              <p className="mt-1 text-[10px] text-muted">
                严重 {criticalAlarmCount} 条 · 需人工确认
              </p>
            </div>
            <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-muted" />
          </Link>
          <Link
            href="/app/pdm/suggestions"
            className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-paper/60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
              <Wrench className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">待确认建议工单</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-[20px] leading-none tabular-nums">
                  {pendingSuggestionCount}
                </span>
                <span className="text-[10px] text-muted">条</span>
              </p>
              <p className="mt-1 text-[10px] text-muted">
                由报警生成，确认后转正式工单
              </p>
            </div>
            <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-muted" />
          </Link>
          <Link
            href="/app/inspection/abnormal"
            className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-paper/60"
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                abnormalWeekCount > 0
                  ? "bg-danger-soft text-danger"
                  : "bg-paper text-muted"
              }`}
            >
              <Warning className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">近 7 天点检异常</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-[20px] leading-none tabular-nums">
                  {abnormalWeekCount}
                </span>
                <span className="text-[10px] text-muted">项</span>
              </p>
              <p className="mt-1 text-[10px] text-muted">
                查看异常测点与处理记录
              </p>
            </div>
            <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-muted" />
          </Link>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="card rise p-5 lg:p-6">
          <SectionTitle
            title="设备状态"
            extra={
              <Link
                href="/app/assets"
                className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-ink"
              >
                查看全部 <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-ink/5">
            {assetOrder.map((key) => {
              const value = assetCounts[key];
              if (!value) return null;
              return (
                <div
                  key={key}
                  className={assetColors[key]}
                  style={{ width: `${(value / (assetTotal || 1)) * 100}%` }}
                />
              );
            })}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {assetOrder.map((key) => (
              <div key={key} className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 text-[12px] text-muted">
                  <span
                    className={`size-2 rounded-full ${assetColors[key]}`}
                  />
                  {ASSET_STATUS[key].label}
                </span>
                <span className="font-mono text-[13px] tabular-nums">
                  {assetCounts[key]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-[11px]">
            <span className="text-muted">在册设备</span>
            <span className="font-mono text-ink">
              {assetTotal} 台 · A 类关键设备 {criticalA} 台
            </span>
          </div>
        </section>

        <section className="card rise p-5 lg:p-6">
          <SectionTitle
            title="工单进度"
            extra={
              <Link
                href="/app/work-orders"
                className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-ink"
              >
                看板 <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <div className="mt-4 space-y-3.5">
            {["new", "assigned", "in_progress", "pending_acceptance", "completed"].map(
              (key) => (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="text-ink-soft">{WO_STATUS[key].label}</span>
                    <span className="font-mono tabular-nums text-muted">
                      {woCountMap[key]}
                    </span>
                  </div>
                  <Bar
                    value={woCountMap[key]}
                    total={Math.max(openWo, 1)}
                    tone={barTone[key] ?? "ink"}
                  />
                </div>
              ),
            )}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            待派工 {woCountMap.new} 张，占未关闭工单{" "}
            {openWo ? Math.round((woCountMap.new / openWo) * 100) : 0}%。
          </p>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="card rise overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">最近工单</h2>
            <Link
              href="/app/work-orders"
              className="text-[11px] text-muted transition-colors hover:text-ink"
            >
              全部工单
            </Link>
          </div>
          {recentWo.length === 0 ? (
            <EmptyState title="还没有工单" hint="从扫码报修或新建工单开始。" />
          ) : (
            <ul className="divide-y divide-line">
              {recentWo.map((wo) => (
                <li key={wo.id}>
                  <Link
                    href={`/app/work-orders/${wo.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                  >
                    <span className="hidden sm:block">
                      <Avatar name={wo.assigneeName ?? "待"} size="sm" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{wo.title}</p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                        {wo.code} · {wo.assetName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={WO_STATUS[wo.status].tone}>
                        {WO_STATUS[wo.status].label}
                      </Badge>
                      <span className="text-[10px] text-muted">
                        {fmtDateTime(wo.createdAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card rise overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">待办保养</h2>
            <Link
              href="/app/inspection"
              className="text-[11px] text-muted transition-colors hover:text-ink"
            >
              全部任务
            </Link>
          </div>
          {taskRows.length === 0 ? (
            <EmptyState title="没有待办任务" hint="巡检计划会自动生成任务。" />
          ) : (
            <ul className="divide-y divide-line">
              {taskRows.slice(0, 6).map((task) => {
                const late = isOverdue(task.dueAt) && task.status === "pending";
                return (
                  <li key={task.id}>
                    <Link
                      href={`/app/inspection/tasks/${task.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                          late ? "bg-danger-soft text-danger" : "bg-paper text-muted"
                        }`}
                      >
                        <CalendarDots className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium">
                          {task.assetName}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                          {task.assetCode} · {fmtDay(task.dueAt)}
                          {late ? " · 已逾期" : ""}
                        </p>
                      </div>
                      <Badge tone={TASK_STATUS[task.status].tone}>
                        {TASK_STATUS[task.status].label}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
