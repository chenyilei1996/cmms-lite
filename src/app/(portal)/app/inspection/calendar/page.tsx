import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assets, inspectionTasks, maintenancePlans } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { PLAN_TYPE, PM_TRIGGER } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { Badge, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "维护日历" };

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function InspectionCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const manageable = canManage(user.role);
  const sp = await searchParams;
  const base = sp.month ? new Date(`${sp.month}-01T00:00:00`) : new Date();
  const year = Number.isNaN(base.getTime()) ? new Date().getFullYear() : base.getFullYear();
  const month = Number.isNaN(base.getTime()) ? new Date().getMonth() : base.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const cells = Math.ceil((startWeekday + last.getDate()) / 7) * 7;

  const [planRows, taskRows] = await Promise.all([
    db
      .select({
        id: maintenancePlans.id,
        name: maintenancePlans.name,
        type: maintenancePlans.type,
        nextDueAt: maintenancePlans.nextDueAt,
        triggerType: maintenancePlans.triggerType,
        active: maintenancePlans.active,
        assetName: assets.name,
      })
      .from(maintenancePlans)
      .innerJoin(assets, eq(maintenancePlans.assetId, assets.id))
      .where(eq(maintenancePlans.active, true))
      .orderBy(asc(maintenancePlans.nextDueAt)),
    db
      .select({
        id: inspectionTasks.id,
        dueAt: inspectionTasks.dueAt,
        status: inspectionTasks.status,
        type: inspectionTasks.type,
        assetName: assets.name,
      })
      .from(inspectionTasks)
      .innerJoin(assets, eq(inspectionTasks.assetId, assets.id))
      .where(inArray(inspectionTasks.status, ["pending"]))
      .orderBy(asc(inspectionTasks.dueAt)),
  ]);

  const byDay = new Map<number, { label: string; href: string; tone: "mint" | "honey" }[]>();
  for (const plan of planRows) {
    if (plan.nextDueAt.getFullYear() !== year || plan.nextDueAt.getMonth() !== month) continue;
    const day = plan.nextDueAt.getDate();
    const list = byDay.get(day) ?? [];
    list.push({
      label: `${plan.assetName} · ${plan.name}`,
      href: manageable
        ? `/admin/inspection/plans/${plan.id}/edit`
        : `/app/inspection`,
      tone: plan.type === "maintenance" ? "honey" : "mint",
    });
    byDay.set(day, list);
  }
  for (const task of taskRows) {
    if (task.dueAt.getFullYear() !== year || task.dueAt.getMonth() !== month) continue;
    const day = task.dueAt.getDate();
    const list = byDay.get(day) ?? [];
    list.push({
      label: `待办 · ${task.assetName}`,
      href: `/app/inspection/tasks/${task.id}`,
      tone: "mint",
    });
    byDay.set(day, list);
  }

  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const today = new Date();

  return (
    <>
      <PageHeader
        eyebrow="Preventive maintenance"
        title={`${year} 年 ${month + 1} 月维护日历`}
        description="按计划到期日展示 PM 与待执行任务。点击条目可进入计划或任务。"
        actions={
          <>
            <LinkButton href={`/app/inspection/calendar?month=${monthKey(prev)}`} variant="secondary">
              上一月
            </LinkButton>
            <LinkButton href={`/app/inspection/calendar?month=${monthKey(next)}`} variant="secondary">
              下一月
            </LinkButton>
            {manageable && (
              <LinkButton href="/admin/inspection" variant="secondary">
                <ArrowLeft className="size-4" /> 计划列表
              </LinkButton>
            )}
          </>
        }
      />

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-paper/50 text-center">
          {["日", "一", "二", "三", "四", "五", "六"].map((label) => (
            <div key={label} className="px-2 py-2 text-[10px] text-muted">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: cells }).map((_, index) => {
            const day = index - startWeekday + 1;
            const inMonth = day >= 1 && day <= last.getDate();
            const items = inMonth ? (byDay.get(day) ?? []) : [];
            const isToday =
              inMonth &&
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === day;
            return (
              <div
                key={index}
                className={`min-h-24 border-b border-r border-line p-1.5 ${
                  inMonth ? "bg-surface" : "bg-paper/40"
                }`}
              >
                {inMonth && (
                  <>
                    <p
                      className={`mb-1 text-[10px] ${
                        isToday
                          ? "inline-flex size-5 items-center justify-center rounded-full bg-accent text-white"
                          : "text-muted"
                      }`}
                    >
                      {day}
                    </p>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((item, i) => (
                        <Link
                          key={`${item.href}-${i}`}
                          href={item.href}
                          className={`block truncate rounded px-1 py-0.5 text-[9px] ${
                            item.tone === "honey"
                              ? "bg-honey-soft text-honey"
                              : "bg-mint-soft text-mint"
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                      {items.length > 3 && (
                        <p className="px-1 text-[9px] text-muted">+{items.length - 3}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-honey" /> 保养 / PM
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-mint" /> 巡检 / 待办任务
        </span>
        <span>当月计划 {planRows.filter((p) => p.nextDueAt.getMonth() === month && p.nextDueAt.getFullYear() === year).length} 条</span>
      </div>

      <section className="mt-6 card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">本月计划明细</h2>
        </div>
        <ul className="divide-y divide-line">
          {planRows
            .filter((p) => p.nextDueAt.getMonth() === month && p.nextDueAt.getFullYear() === year)
            .map((plan) => (
              <li key={plan.id} className="flex items-center gap-3 px-5 py-3">
                <Badge tone={PLAN_TYPE[plan.type].tone}>{PLAN_TYPE[plan.type].label}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">{plan.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {plan.assetName} · {PM_TRIGGER[plan.triggerType]?.label} · 到期{" "}
                    {fmtDate(plan.nextDueAt)}
                  </p>
                </div>
                {manageable && (
                  <Link
                    href={`/admin/inspection/plans/${plan.id}/edit`}
                    className="text-[11px] text-muted hover:text-ink"
                  >
                    编辑
                  </Link>
                )}
              </li>
            ))}
          {planRows.filter(
            (p) => p.nextDueAt.getMonth() === month && p.nextDueAt.getFullYear() === year,
          ).length === 0 && (
            <li className="px-5 py-6 text-[12px] text-muted">本月没有到期计划。</li>
          )}
        </ul>
      </section>
    </>
  );
}
