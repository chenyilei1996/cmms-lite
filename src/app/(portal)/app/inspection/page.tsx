import { CalendarCheck, CalendarDots, ClipboardText, ListChecks, Path, SlidersHorizontal, Timer, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inspectionTasks,
  inspectionTemplates,
  maintenancePlans,
  users,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { PLAN_TYPE, TASK_STATUS } from "@/lib/constants";
import { fmtDate, isOverdue, pct } from "@/lib/utils";
import { ensureDueTasks } from "@/server/inspection-actions";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";

export const metadata = { title: "巡检与保养" };

export default async function InspectionPage() {
  const user = await requireUser();
  const manageable = canManage(user.role);
  await ensureDueTasks();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [taskRows, planRows, templateRows, recentRows] = await Promise.all([
    db
      .select({
        id: inspectionTasks.id,
        dueAt: inspectionTasks.dueAt,
        status: inspectionTasks.status,
        type: inspectionTasks.type,
        completedAt: inspectionTasks.completedAt,
        assetName: assets.name,
        assetCode: assets.code,
        templateName: inspectionTemplates.name,
        assigneeName: users.name,
      })
      .from(inspectionTasks)
      .innerJoin(assets, eq(inspectionTasks.assetId, assets.id))
      .innerJoin(
        inspectionTemplates,
        eq(inspectionTasks.templateId, inspectionTemplates.id),
      )
      .leftJoin(users, eq(inspectionTasks.assigneeId, users.id))
      .orderBy(asc(inspectionTasks.status), asc(inspectionTasks.dueAt))
      .limit(60),
    db
      .select({
        id: maintenancePlans.id,
        active: maintenancePlans.active,
      })
      .from(maintenancePlans),
    db
      .select({ id: inspectionTemplates.id })
      .from(inspectionTemplates),
    db
      .select({ status: inspectionTasks.status })
      .from(inspectionTasks)
      .where(gte(inspectionTasks.dueAt, since)),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const pending = taskRows.filter((t) => t.status === "pending");
  const overdue = pending.filter((t) => t.dueAt < startOfToday);
  const today = pending.filter(
    (t) => t.dueAt >= startOfToday && t.dueAt < new Date(startOfToday.getTime() + 86400000),
  );
  const finished = taskRows.filter((t) => t.status !== "pending").slice(0, 8);
  const monthTotal = recentRows.length;
  const monthDone = recentRows.filter((t) => t.status === "done").length;
  const monthRate = pct(monthDone, monthTotal);

  return (
    <>
      <PageHeader
        eyebrow="Preventive maintenance"
        title="巡检与保养"
        description="按周期自动生成任务。到期的任务会进入待办，异常可以一键转成维修工单。"
        actions={
          <>
            <LinkButton href="/app/inspection/abnormal" variant="secondary">
              <Warning className="size-4" /> 异常记录
            </LinkButton>
            <LinkButton href="/app/inspection/routes" variant="secondary">
              <Path className="size-4" /> 点检路线
            </LinkButton>
            <LinkButton href="/app/inspection/calendar" variant="secondary">
              <CalendarDots className="size-4" /> 日历
            </LinkButton>
            {manageable && (
              <LinkButton href="/admin/inspection" variant="secondary">
                <SlidersHorizontal className="size-4" /> 巡检配置
              </LinkButton>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="待执行"
          value={pending.length}
          tone="honey"
          icon={<ClipboardText className="size-4" />}
          sub="含今日与逾期"
        />
        <StatCard
          label="已逾期"
          value={overdue.length}
          tone="danger"
          icon={<Timer className="size-4" />}
          sub="需要优先处理"
        />
        <StatCard
          label="今日到期"
          value={today.length}
          tone="accent"
          icon={<CalendarDots className="size-4" />}
          sub="按计划自动生成"
        />
        <StatCard
          label="启用计划"
          value={planRows.filter((p) => p.active).length}
          tone="mint"
          icon={<CalendarCheck className="size-4" />}
          sub={`共 ${templateRows.length} 套模板`}
        />
        <StatCard
          label="近30天完成率"
          value={`${monthRate}%`}
          tone="mint"
          icon={<CalendarCheck className="size-4" />}
          sub={`${monthDone}/${monthTotal} 已完成`}
        />
      </div>

      <div className="mt-4 space-y-4">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">待执行任务</h2>
            <span className="label-mono">{pending.length} OPEN</span>
          </div>
          {pending.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="size-7" />}
              title="没有待执行任务"
              hint={
                manageable
                  ? "计划到期后会自动生成，也可以先到后台建立巡检计划。"
                  : "计划到期后会自动生成任务。"
              }
              action={
                manageable ? (
                  <LinkButton href="/admin/inspection" size="sm">
                    巡检配置
                  </LinkButton>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((task) => {
                const late = isOverdue(task.dueAt);
                return (
                  <li key={task.id}>
                    <Link
                      href={`/app/inspection/tasks/${task.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                    >
                      <Badge tone={PLAN_TYPE[task.type].tone}>
                        {PLAN_TYPE[task.type].label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium">
                          {task.assetName} · {task.templateName}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted">
                          {task.assetCode} · 负责人 {task.assigneeName ?? "未指派"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-[11px] ${
                            late ? "font-medium text-danger" : "text-muted"
                          }`}
                        >
                          {late ? "已逾期" : "到期"} {fmtDate(task.dueAt)}
                        </p>
                        <Badge tone={TASK_STATUS[task.status].tone} className="mt-1">
                          {TASK_STATUS[task.status].label}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {finished.length > 0 && (
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[13px] font-semibold">最近完成</h2>
            </div>
            <ul className="divide-y divide-line">
              {finished.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/app/inspection/tasks/${task.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-paper/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px]">
                        {task.assetName} · {task.templateName}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted">
                        {task.completedAt ? fmtDate(task.completedAt) : fmtDate(task.dueAt)}
                      </p>
                    </div>
                    <Badge tone={TASK_STATUS[task.status].tone}>
                      {TASK_STATUS[task.status].label}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
