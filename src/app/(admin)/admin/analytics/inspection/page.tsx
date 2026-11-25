import { Path, ShieldWarning, Warning } from "@phosphor-icons/react/dist/ssr";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inspectionPoints,
  inspectionRunItems,
  inspectionRuns,
  inspectionRoutes,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { RUN_STATUS } from "@/lib/constants";
import {
  DataCutoff,
  ExportLink,
  ReportFilters,
  ReportNote,
  ReportTabs,
} from "@/components/report-chrome";
import { Badge, Bar, PageHeader, StatCard } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { fmtPercent, resolveDays } from "@/lib/reporting";

export const metadata = { title: "点检分析" };

export default async function InspectionAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; route?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const days = resolveDays(sp.days);
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);

  const [runRows, routeRows, anomalyRows] = await Promise.all([
    db
      .select({
        id: inspectionRuns.id,
        routeId: inspectionRuns.routeId,
        routeName: inspectionRoutes.name,
        status: inspectionRuns.status,
        dueAt: inspectionRuns.dueAt,
        completedAt: inspectionRuns.completedAt,
        executorName: inspectionRuns.executorName,
      })
      .from(inspectionRuns)
      .innerJoin(inspectionRoutes, eq(inspectionRuns.routeId, inspectionRoutes.id))
      .where(lt(inspectionRuns.dueAt, now))
      .orderBy(desc(inspectionRuns.dueAt)),
    db
      .select({ id: inspectionRoutes.id, name: inspectionRoutes.name })
      .from(inspectionRoutes)
      .orderBy(asc(inspectionRoutes.name)),
    db
      .select({
        pointName: inspectionPoints.name,
        assetName: assets.name,
        at: sql<string>`max(${inspectionRuns.dueAt})`,
        routeId: inspectionRuns.routeId,
        n: sql<number>`count(*)`,
      })
      .from(inspectionRunItems)
      .innerJoin(inspectionRuns, eq(inspectionRunItems.runId, inspectionRuns.id))
      .innerJoin(inspectionPoints, eq(inspectionRunItems.pointId, inspectionPoints.id))
      .innerJoin(assets, eq(inspectionPoints.assetId, assets.id))
      .where(
        and(
          eq(inspectionRunItems.status, "abnormal"),
          gte(inspectionRuns.dueAt, since),
        ),
      )
      .groupBy(
        inspectionPoints.id,
        inspectionPoints.name,
        assets.name,
        inspectionRuns.routeId,
      )
      .orderBy(desc(sql`count(*)`))
      .limit(8),
  ]);

  const filteredRuns = runRows.filter(
    (run) => !sp.route || run.routeId === sp.route,
  );
  const periodRuns = filteredRuns.filter((run) => run.dueAt >= since);
  const doneRuns = periodRuns.filter((run) => run.status === "done");
  const missedRuns = periodRuns.filter((run) => run.status === "missed");
  const pendingRuns = filteredRuns.filter(
    (run) => run.status === "pending" || run.status === "in_progress",
  );
  const anomalies = anomalyRows.filter(
    (row) => !sp.route || row.routeId === sp.route,
  );
  const anomalyTotal = anomalies.reduce((sum, row) => sum + Number(row.n), 0);

  const routeStats = new Map<
    string,
    { name: string; due: number; done: number; missed: number; abnormal: number }
  >();
  for (const run of periodRuns) {
    const entry = routeStats.get(run.routeId) ?? {
      name: run.routeName,
      due: 0,
      done: 0,
      missed: 0,
      abnormal: 0,
    };
    entry.due += 1;
    if (run.status === "done") entry.done += 1;
    if (run.status === "missed") entry.missed += 1;
    routeStats.set(run.routeId, entry);
  }
  for (const row of anomalies) {
    const entry = routeStats.get(row.routeId);
    if (entry) entry.abnormal += Number(row.n);
  }
  const routeRowsStats = [...routeStats.values()].sort(
    (a, b) => b.due - a.due,
  );
  const maxRouteDue = Math.max(...routeRowsStats.map((row) => row.due), 1);

  return (
    <>
      <PageHeader
        eyebrow="Reports · inspection routes"
        title="点检分析"
        description="路线执行完成率、漏检、异常项 TOP 与按路线统计。分母为统计期内到期的点检路线任务。"
        actions={
          <ExportLink report="inspection" days={days} filters={{ route: sp.route }} />
        }
      />
      <ReportTabs active="/admin/analytics/inspection" />
      <ReportFilters
        basePath="/admin/analytics/inspection"
        days={days}
        selects={[
          {
            name: "route",
            label: "点检路线",
            value: sp.route,
            allLabel: "全部路线",
            options: routeRows.map((row) => ({
              value: row.id,
              label: row.name,
            })),
          },
        ]}
      />
      <DataCutoff
        now={now}
        days={days}
        extra={`到期路线任务 ${periodRuns.length} 条 · 待执行 ${pendingRuns.length} 条`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="到期任务"
          value={periodRuns.length}
          tone="accent"
          icon={<Path className="size-4" />}
          sub="统计期内应执行"
        />
        <StatCard
          label="完成率"
          value={fmtPercent(doneRuns.length, periodRuns.length)}
          tone="mint"
          icon={<Path className="size-4" />}
          sub={`${doneRuns.length} 条已完成`}
        />
        <StatCard
          label="漏检"
          value={missedRuns.length}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub={fmtPercent(missedRuns.length, periodRuns.length) + " 漏检率"}
        />
        <StatCard
          label="异常项"
          value={anomalyTotal}
          tone="honey"
          icon={<ShieldWarning className="size-4" />}
          sub="点检填报判异"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">按路线统计</h2>
            <span className="label-mono">{routeRowsStats.length} ROUTES</span>
          </div>
          {routeRowsStats.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">当前筛选下没有到期任务。</p>
          ) : (
            <ul className="divide-y divide-line">
              {routeRowsStats.map((row) => (
                <li key={row.name} className="px-5 py-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="min-w-0 truncate font-medium">{row.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {row.done}/{row.due} · {fmtPercent(row.done, row.due)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar
                      value={row.done}
                      total={maxRouteDue}
                      tone={row.missed > 0 ? "honey" : "mint"}
                    />
                  </div>
                  {row.missed > 0 && (
                    <p className="mt-1 text-[10px] text-danger">
                      漏检 {row.missed} 条 · 异常 {row.abnormal} 项
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">异常项 TOP</h2>
            <span className="label-mono">BY POINT</span>
          </div>
          {anomalies.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">当前周期没有异常项。</p>
          ) : (
            <ul className="divide-y divide-line">
              {anomalies.map((row, index) => (
                <li
                  key={`${row.pointName}-${row.assetName}-${index}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-[12px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.pointName}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                      {row.assetName} · 最近 {fmtDateTime(row.at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 font-mono text-[10px] text-danger">
                    {Number(row.n)} 次
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">最近路线任务</h2>
          <span className="label-mono">{filteredRuns.length} RUNS</span>
        </div>
        {filteredRuns.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-muted">没有路线任务。</p>
        ) : (
          <ul className="divide-y divide-line">
            {filteredRuns.slice(0, 12).map((run) => (
              <li
                key={run.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{run.routeName}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                    到期 {fmtDateTime(run.dueAt)}
                    {run.executorName ? ` · ${run.executorName}` : ""}
                    {run.completedAt ? ` · 完成 ${fmtDateTime(run.completedAt)}` : ""}
                  </p>
                </div>
                <Badge tone={RUN_STATUS[run.status]?.tone ?? "neutral"}>
                  {RUN_STATUS[run.status]?.label ?? run.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReportNote>
        路线任务按到期时间归入统计期；完成率 = 已完成 ÷ 到期任务；漏检率 = 漏检 ÷ 到期任务。异常项来自点检填报中判为异常的检查点，按点位聚合。
      </ReportNote>
    </>
  );
}
