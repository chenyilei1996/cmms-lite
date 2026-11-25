import { ArrowLeft, Path, Plus, Timer } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  inspectionPoints,
  inspectionRuns,
  inspectionRoutes,
  users,
} from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { RUN_STATUS } from "@/lib/constants";
import { ensureDueRuns } from "@/server/route-actions";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { RouteForm } from "./route-form";

export const metadata = { title: "点检路线" };

export default async function InspectionRoutesPage() {
  const user = await requireUser();
  const canEdit = canRepair(user.role);
  await ensureDueRuns();

  const [routeRows, pointRows, runRows, userRows] = await Promise.all([
    db
      .select({
        id: inspectionRoutes.id,
        name: inspectionRoutes.name,
        publicToken: inspectionRoutes.publicToken,
        cycleDays: inspectionRoutes.cycleDays,
        active: inspectionRoutes.active,
        assigneeName: users.name,
      })
      .from(inspectionRoutes)
      .leftJoin(users, eq(inspectionRoutes.assigneeId, users.id))
      .orderBy(desc(inspectionRoutes.active), asc(inspectionRoutes.name)),
    db
      .select({ routeId: inspectionPoints.routeId })
      .from(inspectionPoints),
    db
      .select({
        id: inspectionRuns.id,
        routeId: inspectionRuns.routeId,
        status: inspectionRuns.status,
        dueAt: inspectionRuns.dueAt,
      })
      .from(inspectionRuns),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.role, ["technician", "manager"]))
      .orderBy(asc(users.name)),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const pointsByRoute = new Map<string, number>();
  for (const point of pointRows) {
    pointsByRoute.set(point.routeId, (pointsByRoute.get(point.routeId) ?? 0) + 1);
  }

  const pending = runRows.filter(
    (run) =>
      ["pending", "in_progress"].includes(run.status) && run.dueAt >= startOfToday,
  );
  const missed = runRows.filter(
    (run) => run.status === "missed" || (run.status === "pending" && run.dueAt < startOfToday),
  );

  return (
    <>
      <PageHeader
        eyebrow="Inspection routes"
        title="点检路线"
        description="一条路线串起多个设备点位，现场扫路线码即可按顺序点检；异常项自动生成工单。"
        actions={
          <LinkButton href="/app/inspection" variant="secondary">
            <ArrowLeft className="size-4" /> 返回保养
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="启用路线" value={routeRows.filter((r) => r.active).length} tone="mint" icon={<Path className="size-4" />} />
        <StatCard label="点检点位" value={pointRows.length} tone="neutral" icon={<Path className="size-4" />} />
        <StatCard label="待执行" value={pending.length} tone="honey" icon={<Timer className="size-4" />} />
        <StatCard label="漏检" value={missed.length} tone="danger" icon={<Timer className="size-4" />} sub="含逾期未执行" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">路线列表</h2>
            <span className="label-mono">{routeRows.length} ROUTES</span>
          </div>
          {routeRows.length === 0 ? (
            <EmptyState
              icon={<Path className="size-7" />}
              title="还没有点检路线"
              hint="先创建一条路线，再把设备点位挂进去。"
            />
          ) : (
            <ul className="divide-y divide-line">
              {routeRows.map((route) => {
                const routeRuns = runRows.filter((run) => run.routeId === route.id);
                const routePending = routeRuns.filter(
                  (run) =>
                    ["pending", "in_progress"].includes(run.status) &&
                    run.dueAt >= startOfToday,
                );
                const routeMissed = routeRuns.filter(
                  (run) =>
                    run.status === "missed" ||
                    (run.status === "pending" && run.dueAt < startOfToday),
                );
                return (
                  <li key={route.id}>
                    <Link
                      href={`/app/inspection/routes/${route.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                    >
                      <span className="flex size-9 items-center justify-center rounded-lg bg-paper">
                        <Path className="size-4 text-muted" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium">{route.name}</p>
                        <p className="mt-0.5 text-[10px] text-muted">
                          每 {route.cycleDays} 天 · {pointsByRoute.get(route.id) ?? 0} 个点位 ·{" "}
                          {route.assigneeName ?? "未指派"}
                        </p>
                      </div>
                      {routeMissed.length > 0 && (
                        <Badge tone={RUN_STATUS.missed.tone}>漏检 {routeMissed.length}</Badge>
                      )}
                      {routePending.length > 0 && (
                        <Badge tone={RUN_STATUS.pending.tone}>
                          待执行 {routePending.length}
                        </Badge>
                      )}
                      <Badge tone={route.active ? "mint" : "neutral"}>
                        {route.active ? "启用" : "停用"}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="size-4 text-muted" />
            <h2 className="text-[13px] font-semibold">新建路线</h2>
          </div>
          {canEdit ? (
            <RouteForm assignees={userRows} />
          ) : (
            <p className="text-[12px] text-muted">当前角色没有创建路线的权限。</p>
          )}
          <div className="mt-4 rounded-xl bg-paper/60 px-3 py-2 text-[10px] leading-relaxed text-muted">
            建议按「车间 / 班次」建路线，点位顺序按现场行走路径排序，扫码后按顺序填报。
          </div>
        </section>
      </div>
    </>
  );
}
