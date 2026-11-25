import { CalendarCheck, CalendarDots, Gauge, Path, PencilSimple, Plus, Power, Users } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inspectionTemplates,
  maintenancePlans,
  users,
} from "@/db/schema";
import { COUNTER_TYPE, PLAN_TYPE } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import {
  generatePmWorkOrderNow,
  recordCounterReading,
  togglePlanActive,
} from "@/server/inspection-actions";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";

export const metadata = { title: "巡检配置" };

export default async function AdminInspectionPage() {
  const [planRows, templateRows] = await Promise.all([
    db
      .select({
        id: maintenancePlans.id,
        name: maintenancePlans.name,
        type: maintenancePlans.type,
        triggerType: maintenancePlans.triggerType,
        counterType: maintenancePlans.counterType,
        counterInterval: maintenancePlans.counterInterval,
        lastCounterReading: maintenancePlans.lastCounterReading,
        cycleDays: maintenancePlans.cycleDays,
        nextDueAt: maintenancePlans.nextDueAt,
        active: maintenancePlans.active,
        assetName: assets.name,
        assetCode: assets.code,
        templateName: inspectionTemplates.name,
        assigneeName: users.name,
      })
      .from(maintenancePlans)
      .innerJoin(assets, eq(maintenancePlans.assetId, assets.id))
      .innerJoin(
        inspectionTemplates,
        eq(maintenancePlans.templateId, inspectionTemplates.id),
      )
      .leftJoin(users, eq(maintenancePlans.assigneeId, users.id))
      .orderBy(desc(maintenancePlans.active), asc(maintenancePlans.nextDueAt)),
    db
      .select()
      .from(inspectionTemplates)
      .orderBy(desc(inspectionTemplates.createdAt)),
  ]);

  const counterPlans = planRows.filter(
    (plan) => plan.triggerType === "counter" && plan.counterType,
  );

  return (
    <>
      <PageHeader
        eyebrow="Admin · maintenance templates & plans"
        title="巡检配置"
        description="模板决定检查项，计划决定周期与负责人。任务执行与异常转单在前台保养页完成。"
        actions={
          <>
            <LinkButton href="/app/inspection/routes" variant="secondary">
              <Path className="size-4" /> 点检路线与点位
            </LinkButton>
            <LinkButton href="/admin/inspection/templates/new" variant="secondary">
              <Plus className="size-4" /> 新建模板
            </LinkButton>
            <LinkButton href="/admin/inspection/plans/new">
              <Plus className="size-4" /> 新建计划
            </LinkButton>
          </>
        }
      />

      {counterPlans.length > 0 && (
        <section className="card mb-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="size-4 text-muted" />
            <h2 className="text-[13px] font-semibold">运行计数录入</h2>
          </div>
          <p className="mb-4 text-[11px] text-muted">
            录入当前读数，达到间隔值会自动生成 PM 工单，避免漏保。
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {counterPlans.map((plan) => (
              <form
                key={plan.id}
                action={recordCounterReading}
                className="rounded-xl border border-line bg-paper/40 p-3"
              >
                <input type="hidden" name="planId" value={plan.id} />
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium">{plan.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {plan.assetName} · 每 {plan.counterInterval}{" "}
                      {COUNTER_TYPE[plan.counterType ?? ""]?.unit ?? ""} · 上次{" "}
                      {plan.lastCounterReading ?? 0}
                    </p>
                  </div>
                  <Badge tone="neutral">
                    {COUNTER_TYPE[plan.counterType ?? ""]?.label ?? "计数"}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    name="reading"
                    type="number"
                    min={0}
                    required
                    placeholder="当前读数"
                    className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-[12px]"
                  />
                  <SubmitButton
                    size="sm"
                    pendingText="记录中…"
                    className="h-9 rounded-full px-4"
                  >
                    记录
                  </SubmitButton>
                </div>
              </form>
            ))}
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">
            <CalendarCheck className="size-4 text-muted" /> 保养计划
          </h2>
          <span className="label-mono">{planRows.length} PLANS</span>
        </div>
        {planRows.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-7" />}
            title="还没有保养计划"
            hint="先建模板，再按周期或运行计数建立计划。"
            action={
              <LinkButton href="/admin/inspection/plans/new" size="sm">
                新建计划
              </LinkButton>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {planRows.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={PLAN_TYPE[plan.type].tone}>
                      {PLAN_TYPE[plan.type].label}
                    </Badge>
                    <span className="text-[12px] font-medium">{plan.name}</span>
                    <Badge tone={plan.active ? "mint" : "neutral"}>
                      {plan.active ? "启用" : "停用"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {plan.assetName} · {plan.templateName} ·{" "}
                    {plan.triggerType === "counter"
                      ? `每 ${plan.counterInterval} ${COUNTER_TYPE[plan.counterType ?? ""]?.unit ?? ""}`
                      : `每 ${plan.cycleDays} 天`}{" "}
                    · 下次 {fmtDate(plan.nextDueAt)} · 负责人{" "}
                    {plan.assigneeName ?? "未指派"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  {plan.type === "maintenance" && (
                    <form action={generatePmWorkOrderNow}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <ConfirmSubmitButton
                        message={`立即为「${plan.name}」生成一张保养工单？生成后会通知负责人。`}
                        className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-ink"
                      >
                        <Gauge className="size-3" /> 立即生成
                      </ConfirmSubmitButton>
                    </form>
                  )}
                  <Link
                    href={`/admin/inspection/plans/${plan.id}/edit`}
                    className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-ink"
                  >
                    <PencilSimple className="size-3" /> 编辑
                  </Link>
                  <form action={togglePlanActive}>
                    <input type="hidden" name="id" value={plan.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={plan.active ? "0" : "1"}
                    />
                    {plan.active ? (
                      <ConfirmSubmitButton
                        message={`停用后「${plan.name}」不再自动生成保养任务，已生成的任务不受影响。确认停用？`}
                        className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-danger"
                      >
                        <Power className="size-3" /> 停用
                      </ConfirmSubmitButton>
                    ) : (
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-ink"
                      >
                        <Power className="size-3" /> 启用
                      </button>
                    )}
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">
            <CalendarDots className="size-4 text-muted" /> 巡检模板
          </h2>
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <Users className="size-3.5" /> {templateRows.length} 套
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templateRows.map((template) => (
            <div key={template.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold">{template.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {template.category}
                  </p>
                </div>
                <Badge tone="neutral">{template.items.length} 项</Badge>
              </div>
              <ul className="mt-4 space-y-2">
                {template.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-2 text-[11px] text-ink-soft"
                  >
                    <span className="size-1 rounded-full bg-accent" />
                    {item.label}
                    <span className="ml-auto text-[9px] text-muted">
                      {item.type === "check"
                        ? "检查"
                        : item.type === "number"
                          ? "数值"
                          : "文本"}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/admin/inspection/templates/${template.id}/edit`}
                className="mt-4 flex w-full items-center gap-1 border-t border-line pt-3 text-[11px] text-muted transition-colors hover:text-ink"
              >
                <PencilSimple className="size-3" /> 编辑模板
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
