import { ArrowLeft, ArrowUpRight, CalendarDots, Check, SkipForward, Warning, Wrench } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  attachments,
  inspectionTasks,
  inspectionTemplates,
  maintenancePlans,
  users,
  workOrders,
} from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { PLAN_TYPE, TASK_STATUS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import {
  completeTask,
  convertTaskToWorkOrder,
  skipTask,
} from "@/server/inspection-actions";
import {
  Badge,
  LinkButton,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

export const metadata = { title: "巡检任务" };

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [row] = await db
    .select({
      task: inspectionTasks,
      assetName: assets.name,
      assetCode: assets.code,
      templateName: inspectionTemplates.name,
      items: inspectionTemplates.items,
      planName: maintenancePlans.name,
      assigneeName: users.name,
      workOrderCode: workOrders.code,
    })
    .from(inspectionTasks)
    .innerJoin(assets, eq(inspectionTasks.assetId, assets.id))
    .innerJoin(
      inspectionTemplates,
      eq(inspectionTasks.templateId, inspectionTemplates.id),
    )
    .innerJoin(
      maintenancePlans,
      eq(inspectionTasks.planId, maintenancePlans.id),
    )
    .leftJoin(users, eq(inspectionTasks.assigneeId, users.id))
    .leftJoin(workOrders, eq(inspectionTasks.workOrderId, workOrders.id))
    .where(eq(inspectionTasks.id, id))
    .limit(1);

  if (!row) notFound();
  const task = row.task;
  const editable = canRepair(user.role) && task.status === "pending";
  const hasAnomaly = Object.values(task.result ?? {}).includes("异常");

  const photoRows = await db
    .select({ id: attachments.id, fileName: attachments.fileName })
    .from(attachments)
    .where(
      and(
        eq(attachments.entityType, "inspection_task"),
        eq(attachments.entityId, task.id),
      ),
    );

  return (
    <>
      <PageHeader
        eyebrow={`${row.assetCode} · ${PLAN_TYPE[task.type].label}任务`}
        title={`${row.assetName} · ${row.templateName}`}
        description={`来自计划「${row.planName}」 · 到期 ${fmtDate(task.dueAt)}`}
        actions={
          <LinkButton href="/app/inspection" variant="secondary">
            <ArrowLeft className="size-4" /> 返回
          </LinkButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card p-5 lg:p-6">
          <SectionTitle
            title="检查项"
            extra={
              <Badge tone={TASK_STATUS[task.status].tone} dot>
                {TASK_STATUS[task.status].label}
              </Badge>
            }
          />

          {editable ? (
            <form action={completeTask} className="space-y-4">
              <input type="hidden" name="id" value={task.id} />
              <ol className="space-y-3">
                {row.items.map((item, index) => (
                  <li
                    key={item.label}
                    className="rounded-xl border border-line bg-surface px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <label
                        htmlFor={`item_${index}`}
                        className="text-[12px] font-medium"
                      >
                        <span className="mr-2 font-mono text-[10px] text-muted">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item.label}
                        {item.required && <span className="ml-0.5 text-accent">*</span>}
                      </label>
                      <span className="text-[9px] text-muted">
                        {item.type === "check"
                          ? "检查"
                          : item.type === "number"
                            ? "数值"
                            : "文本"}
                      </span>
                    </div>

                    {item.type === "check" ? (
                      <div className="mt-2.5 flex gap-2">
                        {["正常", "异常"].map((value) => (
                          <label key={value} className="flex-1 cursor-pointer">
                            <input
                              type="radio"
                              id={value === "正常" ? `item_${index}` : undefined}
                              name={`item_${index}`}
                              value={value}
                              defaultChecked={value === "正常"}
                              required
                              className="peer sr-only"
                            />
                            <span className="flex items-center justify-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[11px] text-muted transition-all peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">
                              {value === "异常" && (
                                <Warning className="size-3" />
                              )}
                              {value}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : item.type === "number" ? (
                      <input
                        id={`item_${index}`}
                        name={`item_${index}`}
                        type="number"
                        step="any"
                        placeholder="填写实测值"
                        required={item.required}
                        className="mt-2.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none"
                      />
                    ) : (
                      <input
                        id={`item_${index}`}
                        name={`item_${index}`}
                        placeholder="填写观察结果"
                        required={item.required}
                        className="mt-2.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none"
                      />
                    )}
                  </li>
                ))}
              </ol>

              <div>
                <p className="mb-1.5 text-[12px] font-medium text-ink-soft">
                  巡检备注
                </p>
                <textarea
                  name="note"
                  placeholder="异常现象、处理建议或其他说明"
                  className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[12px]"
                />
              </div>

              <div className="flex justify-end">
                <SubmitButton size="lg">提交巡检结果</SubmitButton>
              </div>
            </form>
          ) : (
            <>
              <ul className="space-y-2">
                {row.items.map((item, index) => {
                  const value = task.result?.[item.label];
                  const anomaly = value === "异常";
                  return (
                    <li
                      key={item.label}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${
                        anomaly
                          ? "border-danger/30 bg-danger-soft/40"
                          : "border-line"
                      }`}
                    >
                      <span className="text-[12px]">
                        <span className="mr-2 font-mono text-[10px] text-muted">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item.label}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          anomaly ? "text-danger" : "text-ink-soft"
                        }`}
                      >
                        {value ?? "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {task.note && (
                <p className="mt-4 rounded-xl bg-paper/70 px-4 py-3 text-[12px] leading-relaxed text-muted">
                  {task.note}
                </p>
              )}
              {photoRows.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] text-muted">点检照片</p>
                  <div className="flex flex-wrap gap-2">
                    {photoRows.map((photo) => (
                      <a
                        key={photo.id}
                        href={`/api/files/${photo.id}`}
                        target="_blank"
                        className="overflow-hidden rounded-lg border border-line"
                      >
                        <Image
                          src={`/api/files/${photo.id}`}
                          alt={photo.fileName}
                          width={96}
                          height={96}
                          unoptimized
                          className="size-24 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {task.completedAt && (
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
                  <Check className="size-3.5 text-mint" />
                  完成于 {fmtDateTime(task.completedAt)}
                  {task.executorName ? ` · 执行人 ${task.executorName}` : ""}
                </p>
              )}
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="card sticky top-6 p-5">
            <SectionTitle title="任务信息" />
            <div className="space-y-2.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">类型</span>
                <Badge tone={PLAN_TYPE[task.type].tone}>
                  {PLAN_TYPE[task.type].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">到期</span>
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <CalendarDots className="size-3.5 text-muted" />
                  {fmtDate(task.dueAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">负责人</span>
                <span>{row.assigneeName ?? "未指派"}</span>
              </div>
            </div>

            {hasAnomaly && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[11px] leading-relaxed text-danger">
                <Warning className="mt-0.5 size-4 shrink-0" />
                检查中发现异常项，建议转维修工单跟进。
              </div>
            )}

            <div className="mt-4 space-y-2 border-t border-line pt-4">
              {row.workOrderCode ? (
                <Link
                  href={`/app/work-orders?asset=${row.assetCode}`}
                  className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12px] hover:border-ink/25"
                >
                  <span className="flex items-center gap-1.5">
                    <Wrench className="size-3.5 text-muted" />
                    已转工单
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
                    {row.workOrderCode}
                    <ArrowUpRight className="size-3" />
                  </span>
                </Link>
              ) : (
                editable && (
                  <form action={convertTaskToWorkOrder}>
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton variant="secondary" className="w-full">
                      <Wrench className="size-4" /> 转为维修工单
                    </SubmitButton>
                  </form>
                )
              )}

              {editable && (
                <form action={skipTask}>
                  <input type="hidden" name="id" value={task.id} />
                  <SubmitButton variant="ghost" size="sm" className="w-full">
                    <SkipForward className="size-3.5" /> 跳过本次
                  </SubmitButton>
                </form>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
