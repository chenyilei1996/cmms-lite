"use server";

import { and, eq, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  assets,
  inspectionTasks,
  inspectionTemplates,
  maintenancePlans,
  pmReadings,
  users,
  workOrderEvents,
  workOrders,
  type ChecklistItem,
} from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { makeCode } from "@/lib/utils";

export type PlanFormState = { error?: string };
export type TemplateFormState = { error?: string };

function parseTemplate(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!name || !category) {
    return { error: "请填写模板名称与设备类别" } as const;
  }

  const items: ChecklistItem[] = [];
  for (let index = 0; index < 60; index += 1) {
    const label = String(formData.get(`itemLabel_${index}`) ?? "").trim();
    if (!label) continue;
    const rawType = String(formData.get(`itemType_${index}`) ?? "check");
    const type: ChecklistItem["type"] =
      rawType === "number" || rawType === "text" ? rawType : "check";
    const required =
      String(formData.get(`itemRequired_${index}`) ?? "") === "on";
    items.push({ label, type, ...(required ? { required: true } : {}) });
  }

  if (!items.length) {
    return { error: "请至少填写一个检查项" } as const;
  }

  return { name, category, items };
}

function parsePlan(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const assetId = String(formData.get("assetId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const typeRaw = String(formData.get("type") ?? "inspection");
  const type = typeRaw === "maintenance" ? "maintenance" : "inspection";
  const triggerRaw = String(formData.get("triggerType") ?? "time");
  const triggerType = triggerRaw === "counter" ? "counter" : "time";
  const counterRaw = String(formData.get("counterType") ?? "");
  const counterType =
    counterRaw === "runtime_hours" || counterRaw === "output" || counterRaw === "actions"
      ? counterRaw
      : null;
  const intervalRaw = Number(formData.get("counterInterval") ?? 0);
  const counterInterval =
    Number.isFinite(intervalRaw) && intervalRaw > 0 ? Math.round(intervalRaw) : null;
  const cycleDays = Number(formData.get("cycleDays") ?? 30);
  const nextRaw = String(formData.get("nextDueAt") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const standardRaw = Number(formData.get("standardMinutes") ?? 0);
  const standardMinutes =
    Number.isFinite(standardRaw) && standardRaw > 0 ? Math.round(standardRaw) : null;
  const safetyNotes = String(formData.get("safetyNotes") ?? "").trim() || null;
  const requiredTools = String(formData.get("requiredTools") ?? "").trim() || null;

  if (!name || !assetId || !templateId) {
    return { error: "请填写计划名称并选择设备与模板" } as const;
  }
  if (type === "maintenance" && triggerType === "counter" && (!counterType || !counterInterval)) {
    return { error: "按计数触发需要选择计数类型与间隔值" } as const;
  }

  let nextDueAt = new Date();
  if (nextRaw) {
    nextDueAt = new Date(`${nextRaw}T09:00:00`);
    if (Number.isNaN(nextDueAt.getTime())) nextDueAt = new Date();
  }

  return {
    name,
    assetId,
    templateId,
    type,
    triggerType,
    counterType,
    counterInterval,
    cycleDays:
      Number.isFinite(cycleDays) && cycleDays > 0 ? Math.round(cycleDays) : 30,
    nextDueAt,
    assigneeId,
    standardMinutes,
    safetyNotes,
    requiredTools,
  } as const;
}

export async function createTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await requireUser();
  if (!canRepair(user.role)) return { error: "没有创建模板的权限" };

  const parsed = parseTemplate(formData);
  if ("error" in parsed) return { error: parsed.error };

  await db.insert(inspectionTemplates).values(parsed);

  revalidatePath("/app/inspection");
  redirect("/admin/inspection");
}

export async function updateTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await requireUser();
  if (!canRepair(user.role)) return { error: "没有编辑模板的权限" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "模板不存在" };

  const parsed = parseTemplate(formData);
  if ("error" in parsed) return { error: parsed.error };

  await db
    .update(inspectionTemplates)
    .set(parsed)
    .where(eq(inspectionTemplates.id, id));

  revalidatePath("/app/inspection");
  redirect("/admin/inspection");
}

async function createPmWorkOrder(plan: typeof maintenancePlans.$inferSelect) {
  const open = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.planId, plan.id),
        eq(workOrders.type, "pm"),
        inArray(workOrders.status, [
          "new",
          "assigned",
          "in_progress",
          "pending_acceptance",
        ]),
      ),
    )
    .limit(1);
  if (open.length) return null;

  const [row] = await db
    .select({
      assetName: assets.name,
      templateName: inspectionTemplates.name,
      items: inspectionTemplates.items,
    })
    .from(maintenancePlans)
    .innerJoin(assets, eq(maintenancePlans.assetId, assets.id))
    .innerJoin(
      inspectionTemplates,
      eq(maintenancePlans.templateId, inspectionTemplates.id),
    )
    .where(eq(maintenancePlans.id, plan.id))
    .limit(1);
  if (!row) return null;

  const checklist = (row.items ?? []).map((item) => item.label).join("、");
  const [wo] = await db
    .insert(workOrders)
    .values({
      code: makeCode("WO"),
      assetId: plan.assetId,
      type: "pm",
      title: `${row.assetName} · ${plan.name}`,
      description: [
        "由预防性维护计划自动生成。",
        checklist ? `检查项：${checklist}` : null,
        plan.safetyNotes ? `安全要求：${plan.safetyNotes}` : null,
        plan.requiredTools ? `所需工具：${plan.requiredTools}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      status: plan.assigneeId ? "assigned" : "new",
      priority: "medium",
      assigneeId: plan.assigneeId,
      planId: plan.id,
      dueAt: plan.nextDueAt,
    })
    .returning({ id: workOrders.id });

  await db.insert(workOrderEvents).values({
    workOrderId: wo.id,
    fromStatus: null,
    toStatus: plan.assigneeId ? "assigned" : "new",
    note: "PM 到期自动建单",
  });
  await audit({
    entityType: "work_order",
    entityId: wo.id,
    action: "work_order.pm_auto",
    detail: { planId: plan.id },
  });
  await notify(
    plan.assigneeId,
    `PM 到期：${plan.name}`,
    "预防性维护已自动生成工单，请按模板执行。",
    `/app/work-orders/${wo.id}`,
  );
  return wo.id;
}

async function ensureDuePmWorkOrders() {
  const now = new Date();
  const plans = await db
    .select()
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.active, true),
        eq(maintenancePlans.type, "maintenance"),
        eq(maintenancePlans.triggerType, "time"),
        lte(maintenancePlans.nextDueAt, now),
      ),
    );

  for (const plan of plans) {
    const existing = await db
      .select({ id: workOrders.id, status: workOrders.status })
      .from(workOrders)
      .where(and(eq(workOrders.planId, plan.id), eq(workOrders.type, "pm")));
    const hasOpen = existing.some(
      (row) => !["completed", "closed", "cancelled"].includes(row.status),
    );
    if (!hasOpen) {
      await createPmWorkOrder(plan);
    }

    const next = new Date(plan.nextDueAt);
    const cycle = Math.max(1, plan.cycleDays);
    while (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + cycle);
    }
    await db
      .update(maintenancePlans)
      .set({ nextDueAt: next })
      .where(eq(maintenancePlans.id, plan.id));
  }
}

export async function ensureDueTasks() {
  const now = new Date();
  const plans = await db
    .select()
    .from(maintenancePlans)
    .where(and(eq(maintenancePlans.active, true), lte(maintenancePlans.nextDueAt, now)));

  for (const plan of plans) {
    if (plan.triggerType === "counter") continue;

    if (plan.type === "inspection") {
      const pending = await db
        .select({ id: inspectionTasks.id })
        .from(inspectionTasks)
        .where(
          and(
            eq(inspectionTasks.planId, plan.id),
            eq(inspectionTasks.status, "pending"),
          ),
        )
        .limit(1);

      if (!pending.length) {
        await db.insert(inspectionTasks).values({
          planId: plan.id,
          assetId: plan.assetId,
          templateId: plan.templateId,
          type: plan.type,
          dueAt: plan.nextDueAt,
          assigneeId: plan.assigneeId,
        });
      }

      const next = new Date(plan.nextDueAt);
      const cycle = Math.max(1, plan.cycleDays);
      while (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + cycle);
      }
      await db
        .update(maintenancePlans)
        .set({ nextDueAt: next })
        .where(eq(maintenancePlans.id, plan.id));
    }
  }

  await ensureDuePmWorkOrders();
}

export async function createPlan(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await requireUser();
  if (!canRepair(user.role)) return { error: "没有创建计划的权限" };

  const parsed = parsePlan(formData);
  if ("error" in parsed) return { error: parsed.error };

  await db.insert(maintenancePlans).values(parsed);

  revalidatePath("/app/inspection");
  revalidatePath("/app/dashboard");
  redirect("/admin/inspection");
}

export async function updatePlan(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await requireUser();
  if (!canRepair(user.role)) return { error: "没有编辑计划的权限" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "计划不存在" };

  const parsed = parsePlan(formData);
  if ("error" in parsed) return { error: parsed.error };

  await db
    .update(maintenancePlans)
    .set(parsed)
    .where(eq(maintenancePlans.id, id));

  revalidatePath("/app/inspection");
  redirect("/admin/inspection");
}

export async function togglePlanActive(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const active = String(formData.get("active") ?? "1") === "1";

  await db
    .update(maintenancePlans)
    .set({ active })
    .where(eq(maintenancePlans.id, id));

  await audit({
    entityType: "maintenance_plan",
    entityId: id,
    action: active ? "plan.enable" : "plan.disable",
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath("/app/inspection");
  revalidatePath("/app/dashboard");
}

/** 记录运行计数读数；达到间隔时自动生成 PM 工单。 */
export async function recordCounterReading(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const planId = String(formData.get("planId") ?? "");
  const readingRaw = Number(formData.get("reading") ?? NaN);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!planId || !Number.isFinite(readingRaw)) return;
  const reading = Math.round(readingRaw);

  const [plan] = await db
    .select()
    .from(maintenancePlans)
    .where(eq(maintenancePlans.id, planId))
    .limit(1);
  if (!plan || !plan.counterType) return;

  await db.insert(pmReadings).values({
    assetId: plan.assetId,
    planId: plan.id,
    type: plan.counterType,
    reading,
    note,
    recordedById: user.id,
  });

  const baseline = plan.lastCounterReading ?? 0;
  const interval = plan.counterInterval ?? 0;
  if (interval > 0 && reading - baseline >= interval) {
    const existing = await db
      .select({ id: workOrders.id, status: workOrders.status })
      .from(workOrders)
      .where(and(eq(workOrders.planId, plan.id), eq(workOrders.type, "pm")));
    const hasOpen = existing.some(
      (row) => !["completed", "closed", "cancelled"].includes(row.status),
    );
    if (!hasOpen) {
      await createPmWorkOrder(plan);
    }
    await db
      .update(maintenancePlans)
      .set({ lastCounterReading: reading })
      .where(eq(maintenancePlans.id, plan.id));
  }

  await audit({
    entityType: "maintenance_plan",
    entityId: plan.id,
    action: "plan.counter",
    detail: { reading, baseline, interval },
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath("/app/inspection");
  revalidatePath("/app/dashboard");
  redirect("/admin/inspection");
}

export async function completeTask(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [task] = await db
    .select({
      task: inspectionTasks,
      items: inspectionTemplates.items,
    })
    .from(inspectionTasks)
    .innerJoin(
      inspectionTemplates,
      eq(inspectionTasks.templateId, inspectionTemplates.id),
    )
    .where(eq(inspectionTasks.id, id))
    .limit(1);

  if (!task) return;

  const result: Record<string, string> = {};
  task.items.forEach((item, index) => {
    const value = String(formData.get(`item_${index}`) ?? "").trim();
    if (value) result[item.label] = value;
  });

  await db
    .update(inspectionTasks)
    .set({
      status: "done",
      completedAt: new Date(),
      note: String(formData.get("note") ?? "").trim() || null,
      result,
      assigneeId: task.task.assigneeId ?? user.id,
    })
    .where(eq(inspectionTasks.id, id));

  await db
    .update(maintenancePlans)
    .set({ lastCompletedAt: new Date() })
    .where(eq(maintenancePlans.id, task.task.planId));

  revalidatePath("/app/inspection");
  revalidatePath(`/app/inspection/tasks/${id}`);
  revalidatePath("/app/dashboard");
  redirect(`/app/inspection/tasks/${id}`);
}

export async function skipTask(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(inspectionTasks)
    .set({
      status: "skipped",
      completedAt: new Date(),
      note: String(formData.get("note") ?? "").trim() || "已跳过",
    })
    .where(eq(inspectionTasks.id, id));
  revalidatePath("/app/inspection");
  revalidatePath(`/app/inspection/tasks/${id}`);
  redirect(`/app/inspection/tasks/${id}`);
}

export async function convertTaskToWorkOrder(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [row] = await db
    .select({
      task: inspectionTasks,
      assetName: assets.name,
      templateName: inspectionTemplates.name,
    })
    .from(inspectionTasks)
    .innerJoin(assets, eq(inspectionTasks.assetId, assets.id))
    .innerJoin(
      inspectionTemplates,
      eq(inspectionTasks.templateId, inspectionTemplates.id),
    )
    .where(eq(inspectionTasks.id, id))
    .limit(1);

  if (!row || row.task.workOrderId) return;

  const [wo] = await db
    .insert(workOrders)
    .values({
      code: makeCode("WO"),
      assetId: row.task.assetId,
      type: "inspection",
      title: `${row.assetName} · ${row.templateName}异常`,
      description: `由巡检任务转工单。${row.task.note ?? ""}`.trim(),
      status: "new",
      priority: "medium",
      faultPhenomenon: row.task.note ?? null,
    })
    .returning({ id: workOrders.id });

  await db.insert(workOrderEvents).values({
    workOrderId: wo.id,
    fromStatus: null,
    toStatus: "new",
    note: "由巡检任务转工单",
    actorId: user.id,
  });

  await db
    .update(inspectionTasks)
    .set({ workOrderId: wo.id })
    .where(eq(inspectionTasks.id, id));

  await audit({
    entityType: "work_order",
    entityId: wo.id,
    action: "work_order.from_task",
    detail: { taskId: id },
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath("/app/inspection");
  redirect(`/app/work-orders/${wo.id}`);
}

/** 手动为某条 PM 计划立即建单（用于日历/计划页的“立即生成”）。 */
export async function generatePmWorkOrderNow(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;
  const planId = String(formData.get("planId") ?? "");
  if (!planId) return;
  const [plan] = await db
    .select()
    .from(maintenancePlans)
    .where(eq(maintenancePlans.id, planId))
    .limit(1);
  if (!plan) return;
  const existing = await db
    .select({ id: workOrders.id, status: workOrders.status })
    .from(workOrders)
    .where(and(eq(workOrders.planId, plan.id), eq(workOrders.type, "pm")));
  const hasOpen = existing.some(
    (row) => !["completed", "closed", "cancelled"].includes(row.status),
  );
  if (!hasOpen) await createPmWorkOrder(plan);
  revalidatePath("/app/inspection");
  revalidatePath("/app/work-orders");
  redirect("/admin/inspection");
}

/** PM 计划页需要的执行人列表。 */
export async function planAssignees() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true));
}
