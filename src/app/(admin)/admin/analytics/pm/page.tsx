import { CalendarCheck, Clock, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, asc, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inspectionTasks,
  maintenancePlans,
  workOrders,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { PLAN_TYPE, TASK_STATUS } from "@/lib/constants";
import {
  DataCutoff,
  ExportLink,
  ReportFilters,
  ReportNote,
  ReportTabs,
} from "@/components/report-chrome";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import {
  fmtMinutes,
  fmtPercent,
  periodRange,
  resolveDays,
} from "@/lib/reporting";

export const metadata = { title: "保养分析" };

export default async function PmAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; type?: string; asset?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const days = resolveDays(sp.days);
  const now = new Date();
  const { since } = periodRange(days, now);

  const [taskRows, assetRows] = await Promise.all([
    db
      .select({
        id: inspectionTasks.id,
        planId: inspectionTasks.planId,
        planName: maintenancePlans.name,
        planType: maintenancePlans.type,
        cycleDays: maintenancePlans.cycleDays,
        standardMinutes: maintenancePlans.standardMinutes,
        dueAt: inspectionTasks.dueAt,
        status: inspectionTasks.status,
        completedAt: inspectionTasks.completedAt,
        assetId: inspectionTasks.assetId,
        assetName: assets.name,
        assetCode: assets.code,
        workOrderId: inspectionTasks.workOrderId,
        laborMinutes: workOrders.laborMinutes,
      })
      .from(inspectionTasks)
      .innerJoin(maintenancePlans, eq(inspectionTasks.planId, maintenancePlans.id))
      .innerJoin(assets, eq(inspectionTasks.assetId, assets.id))
      .leftJoin(workOrders, eq(inspectionTasks.workOrderId, workOrders.id))
      .where(lt(inspectionTasks.dueAt, now))
      .orderBy(asc(inspectionTasks.dueAt)),
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

  const filtered = taskRows.filter((task) => {
    if (sp.type && task.planType !== sp.type) return false;
    if (sp.asset && task.assetId !== sp.asset) return false;
    return true;
  });
  const periodTasks = filtered.filter((task) => task.dueAt >= since);
  const doneTasks = periodTasks.filter((task) => task.status === "done");
  const onTimeTasks = doneTasks.filter(
    (task) => task.completedAt && task.completedAt <= task.dueAt,
  );
  const pendingTasks = filtered.filter(
    (task) => task.status === "pending" && task.dueAt < now,
  );
  const linkedTasks = periodTasks.filter((task) => task.workOrderId);

  const planStats = new Map<
    string,
    {
      name: string;
      type: string;
      assetCode: string;
      assetName: string;
      cycleDays: number;
      standardMinutes: number | null;
      due: number;
      done: number;
      onTime: number;
      laborSum: number;
      laborCount: number;
    }
  >();
  for (const task of periodTasks) {
    const entry = planStats.get(task.planId) ?? {
      name: task.planName,
      type: task.planType,
      assetCode: task.assetCode,
      assetName: task.assetName,
      cycleDays: task.cycleDays,
      standardMinutes: task.standardMinutes,
      due: 0,
      done: 0,
      onTime: 0,
      laborSum: 0,
      laborCount: 0,
    };
    entry.due += 1;
    if (task.status === "done") {
      entry.done += 1;
      if (task.completedAt && task.completedAt <= task.dueAt) entry.onTime += 1;
    }
    if (task.laborMinutes !== null) {
      entry.laborSum += task.laborMinutes;
      entry.laborCount += 1;
    }
    planStats.set(task.planId, entry);
  }
  const planRows = [...planStats.values()].sort(
    (a, b) => a.onTime / (a.due || 1) - b.onTime / (b.due || 1),
  );

  return (
    <>
      <PageHeader
        eyebrow="Reports · preventive maintenance"
        title="保养分析"
        description="计划完成率、按期率、逾期清单与标准工时对比。分母为统计期内到期的保养/巡检任务。"
        actions={
          <ExportLink
            report="pm"
            days={days}
            filters={{ type: sp.type, asset: sp.asset }}
          />
        }
      />
      <ReportTabs active="/admin/analytics/pm" />
      <ReportFilters
        basePath="/admin/analytics/pm"
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
          {
            name: "type",
            label: "计划类型",
            value: sp.type,
            allLabel: "全部类型",
            options: Object.entries(PLAN_TYPE).map(([value, meta]) => ({
              value,
              label: meta.label,
            })),
          },
        ]}
      />
      <DataCutoff
        now={now}
        days={days}
        extra={`到期任务 ${periodTasks.length} 条 · 逾期未完成 ${pendingTasks.length} 条`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="到期任务"
          value={periodTasks.length}
          tone="accent"
          icon={<CalendarCheck className="size-4" />}
          sub="统计期内应完成"
        />
        <StatCard
          label="计划完成率"
          value={fmtPercent(doneTasks.length, periodTasks.length)}
          tone="mint"
          icon={<CalendarCheck className="size-4" />}
          sub={`${doneTasks.length} 已完成`}
        />
        <StatCard
          label="按期率"
          value={fmtPercent(onTimeTasks.length, periodTasks.length)}
          tone="honey"
          icon={<Clock className="size-4" />}
          sub={`${onTimeTasks.length} 在到期日前完成`}
        />
        <StatCard
          label="逾期未完成"
          value={pendingTasks.length}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub={`${linkedTasks.length} 条已转工单`}
        />
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">按计划统计</h2>
          <span className="label-mono">{planRows.length} PLANS</span>
        </div>
        {planRows.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-muted">
            当前筛选下没有到期任务。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] text-muted">
                  <th className="px-5 py-2.5 font-medium">计划 / 设备</th>
                  <th className="px-3 py-2.5 font-medium">类型</th>
                  <th className="px-3 py-2.5 text-right font-medium">到期</th>
                  <th className="px-3 py-2.5 text-right font-medium">完成</th>
                  <th className="px-3 py-2.5 text-right font-medium">按期率</th>
                  <th className="px-3 py-2.5 text-right font-medium">标准 / 实际</th>
                  <th className="px-5 py-2.5 text-right font-medium">周期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {planRows.map((plan) => (
                  <tr key={`${plan.name}-${plan.assetCode}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{plan.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted">
                        {plan.assetCode} · {plan.assetName}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={PLAN_TYPE[plan.type]?.tone ?? "neutral"}>
                        {PLAN_TYPE[plan.type]?.label ?? plan.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {plan.due}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {plan.done}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-mono tabular-nums ${
                        plan.onTime / (plan.due || 1) < 0.8 ? "text-danger" : ""
                      }`}
                    >
                      {fmtPercent(plan.onTime, plan.due)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[11px] text-muted">
                      {plan.standardMinutes ?? "—"} /{" "}
                      {plan.laborCount
                        ? Math.round(plan.laborSum / plan.laborCount)
                        : "—"}{" "}
                      分
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-[11px] text-muted">
                      {plan.cycleDays} 天
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">逾期任务</h2>
          <span className="label-mono">{pendingTasks.length} ITEMS</span>
        </div>
        {pendingTasks.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-muted">没有逾期未完成的保养任务。</p>
        ) : (
          <ul className="divide-y divide-line">
            {pendingTasks.slice(0, 12).map((task) => (
              <li key={task.id}>
                <Link
                  href={`/app/inspection/tasks/${task.id}`}
                  className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-paper/60 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{task.planName}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                      {task.assetCode} · {task.assetName} · 到期{" "}
                      {task.dueAt.toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={PLAN_TYPE[task.planType]?.tone ?? "neutral"}>
                      {PLAN_TYPE[task.planType]?.label ?? task.planType}
                    </Badge>
                    <Badge tone={TASK_STATUS[task.status].tone}>
                      {TASK_STATUS[task.status].label}
                    </Badge>
                    <span className="font-mono text-[11px] text-danger">
                      逾期 {fmtMinutes(
                        Math.round((now.getTime() - task.dueAt.getTime()) / 60000),
                      )}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReportNote>
        计划完成率 = 统计期内到期且已完成的任务 ÷ 统计期内到期任务；按期率额外要求完成时间不晚于到期时间。实际工时来自任务转出的工单，未转工单的任务不参与工时对比。
      </ReportNote>
    </>
  );
}
