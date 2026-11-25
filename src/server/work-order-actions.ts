"use server";

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  assets,
  downtimeRecords,
  faultCodes,
  inventoryTransactions,
  partBatches,
  spareParts,
  users,
  workOrderEvents,
  workOrderParts,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { WO_STATUS, WO_TRANSITIONS } from "@/lib/constants";
import { pickUploads, saveUploads } from "@/lib/uploads";
import { makeCode } from "@/lib/utils";

export type WorkOrderFormState = { error?: string };

const WO_TYPES = ["fault", "corrective", "pm", "inspection", "project"] as const;
type WoType = (typeof WO_TYPES)[number];

async function logEvent(
  workOrderId: string,
  fromStatus: string | null,
  toStatus: string,
  note: string,
  actorId: string,
) {
  await db.insert(workOrderEvents).values({
    workOrderId,
    fromStatus,
    toStatus,
    note,
    actorId,
  });
}

async function syncAssetStatus(assetId: string, next?: "repairing" | "in_service") {
  if (!next) return;
  if (next === "in_service") {
    const open = await db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.assetId, assetId),
          inArray(workOrders.status, [
            "new",
            "assigned",
            "in_progress",
            "pending_acceptance",
          ]),
        ),
      )
      .limit(1);
    if (open.length) return;
  }
  await db
    .update(assets)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(assets.id, assetId));
}

async function auditWo(
  id: string,
  action: string,
  actor: { id: string; name: string },
  detail?: Record<string, unknown>,
) {
  await audit({
    entityType: "work_order",
    entityId: id,
    action,
    detail,
    actorId: actor.id,
    actorName: actor.name,
  });
}

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

async function consumeBatches(partId: string, quantity: number) {
  const batches = await db
    .select()
    .from(partBatches)
    .where(and(eq(partBatches.partId, partId), gt(partBatches.quantity, 0)))
    .orderBy(asc(partBatches.receivedAt), asc(partBatches.createdAt));

  let remaining = quantity;
  let firstBatchId: string | null = null;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    await db
      .update(partBatches)
      .set({ quantity: batch.quantity - take })
      .where(eq(partBatches.id, batch.id));
    remaining -= take;
    if (!firstBatchId) firstBatchId = batch.id;
  }
  return firstBatchId;
}

export async function createWorkOrder(
  _prev: WorkOrderFormState,
  formData: FormData,
): Promise<WorkOrderFormState> {
  const user = await requireUser();
  if (!canRepair(user.role)) return { error: "没有创建工单的权限" };

  const assetId = String(formData.get("assetId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const typeRaw = String(formData.get("type") ?? "fault");
  const type: WoType = (WO_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as WoType)
    : "fault";
  const priorityRaw = String(formData.get("priority") ?? "medium");
  const priority = ["low", "medium", "high", "urgent"].includes(priorityRaw)
    ? (priorityRaw as "low" | "medium" | "high" | "urgent")
    : "medium";
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const dueRaw = String(formData.get("dueAt") ?? "");
  const faultCode = String(formData.get("faultCode") ?? "").trim() || null;
  const faultPhenomenon =
    String(formData.get("faultPhenomenon") ?? "").trim() || null;

  if (!assetId || !title) return { error: "请选择设备并填写工单标题" };

  let dueAt: Date | null = null;
  if (dueRaw) {
    dueAt = new Date(`${dueRaw}T18:00:00`);
    if (Number.isNaN(dueAt.getTime())) dueAt = null;
  }

  const [created] = await db
    .insert(workOrders)
    .values({
      code: makeCode("WO"),
      assetId,
      type,
      title,
      description,
      priority,
      assigneeId,
      status: assigneeId ? "assigned" : "new",
      dueAt,
      faultCode,
      faultPhenomenon,
    })
    .returning({ id: workOrders.id });

  await logEvent(
    created.id,
    null,
    assigneeId ? "assigned" : "new",
    assigneeId ? "手动创建并派工" : "手动创建工单",
    user.id,
  );
  await auditWo(created.id, "work_order.create", user, { type, priority });
  await notify(
    assigneeId,
    `新工单：${title}`,
    "有一张工单已派给你，请及时接单。",
    `/app/work-orders/${created.id}`,
  );

  revalidatePath("/app/work-orders");
  redirect(`/app/work-orders/${created.id}`);
}

export async function updateWorkOrder(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const op = String(formData.get("op") ?? "");
  if (!id || !op) return;

  const [wo] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!wo) return;

  const now = new Date();

  if (op === "assign") {
    if (!canManage(user.role)) return;
    const assigneeId = String(formData.get("assigneeId") ?? "");
    if (!assigneeId) return;
    const [tech] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);
    await db
      .update(workOrders)
      .set({ assigneeId, status: "assigned", updatedAt: now })
      .where(eq(workOrders.id, id));
    await logEvent(id, wo.status, "assigned", `派工给 ${tech?.name ?? "维修人员"}`, user.id);
    await auditWo(id, "work_order.assign", user, { assigneeId });
    await notify(
      assigneeId,
      `工单已派给你：${wo.title}`,
      "请进入工单详情接单并开始处理。",
      `/app/work-orders/${id}`,
    );
  }

  if (op === "transfer") {
    if (!canManage(user.role)) return;
    const assigneeId = String(formData.get("assigneeId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!assigneeId || !reason) return;
    const [tech] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);
    await db
      .update(workOrders)
      .set({
        assigneeId,
        status: "assigned",
        transferReason: reason,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));
    await logEvent(id, wo.status, "assigned", `转派给 ${tech?.name ?? "维修人员"}：${reason}`, user.id);
    await auditWo(id, "work_order.transfer", user, { assigneeId, reason });
    await notify(
      assigneeId,
      `工单转派给你：${wo.title}`,
      reason,
      `/app/work-orders/${id}`,
    );
  }

  if (op === "start") {
    if (!canRepair(user.role)) return;
    await db
      .update(workOrders)
      .set({
        status: "in_progress",
        startedAt: wo.startedAt ?? now,
        assigneeId: wo.assigneeId ?? user.id,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));
    await syncAssetStatus(wo.assetId, "repairing");
    await logEvent(id, wo.status, "in_progress", "开始维修", user.id);
    await auditWo(id, "work_order.start", user);
  }

  if (op === "complete") {
    if (!canRepair(user.role)) return;
    const resolution = String(formData.get("resolution") ?? "").trim();
    if (!resolution) return;
    const downtimeRaw = String(formData.get("downtimeMinutes") ?? "").trim();
    const downtimeInput =
      downtimeRaw === "" ? null : Number(downtimeRaw);
    const providedDowntime =
      downtimeInput !== null &&
      Number.isFinite(downtimeInput) &&
      downtimeInput >= 0
        ? Math.round(downtimeInput)
        : null;
    const downtimeStart = wo.startedAt ?? wo.createdAt;
    const autoDowntime = Math.max(
      0,
      Math.round((now.getTime() - downtimeStart.getTime()) / 60000),
    );
    const finalDowntime =
      providedDowntime ?? wo.downtimeMinutes ?? autoDowntime;
    const laborRaw = String(formData.get("laborMinutes") ?? "");
    const laborMinutes = laborRaw ? Number(laborRaw) : null;
    const validLabor =
      laborMinutes !== null &&
      Number.isFinite(laborMinutes) &&
      laborMinutes >= 0
        ? Math.round(laborMinutes)
        : null;
    const signatureName =
      String(formData.get("signatureName") ?? "").trim() || user.name;
    await db
      .update(workOrders)
      .set({
        status: "pending_acceptance",
        resolution,
        downtimeMinutes: finalDowntime,
        laborMinutes: validLabor ?? wo.laborMinutes,
        signatureName,
        signatureAt: now,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));
    await logEvent(
      id,
      wo.status,
      "pending_acceptance",
      validLabor !== null
        ? `维修完成，提交验收（工时 ${validLabor} 分钟，签名 ${signatureName}）`
        : `维修完成，提交验收（签名 ${signatureName}）`,
      user.id,
    );
    await saveUploads(pickUploads(formData), "work_order", id);
    await auditWo(id, "work_order.sign", user, { signatureName });

    let downtimeFaultCodeId = wo.faultCodeId;
    if (!downtimeFaultCodeId && wo.faultCode) {
      const [matched] = await db
        .select({ id: faultCodes.id })
        .from(faultCodes)
        .where(eq(faultCodes.code, wo.faultCode))
        .limit(1);
      downtimeFaultCodeId = matched?.id ?? null;
    }
    const downtimeType: "planned" | "unplanned" =
      wo.type === "pm" || wo.type === "project" ? "planned" : "unplanned";
    const downtimeValues = {
      assetId: wo.assetId,
      faultCodeId: downtimeFaultCodeId,
      type: downtimeType,
      responsibility: wo.responsibility,
      startedAt: downtimeStart,
      endedAt: now,
      minutes: finalDowntime,
      affectedOutput: wo.affectedOutput,
      note: resolution,
      createdById: user.id,
    };
    const [existingDowntime] = await db
      .select({ id: downtimeRecords.id })
      .from(downtimeRecords)
      .where(eq(downtimeRecords.workOrderId, id))
      .limit(1);
    if (existingDowntime) {
      await db
        .update(downtimeRecords)
        .set(downtimeValues)
        .where(eq(downtimeRecords.id, existingDowntime.id));
    } else {
      await db
        .insert(downtimeRecords)
        .values({ ...downtimeValues, workOrderId: id });
    }
    revalidatePath("/app/faults");
  }

  if (op === "setFault") {
    if (!canRepair(user.role)) return;
    const faultCodeId = String(formData.get("faultCodeId") ?? "") || null;
    let faultCode = String(formData.get("faultCode") ?? "").trim() || null;
    let faultPhenomenon =
      String(formData.get("faultPhenomenon") ?? "").trim() || null;
    let faultCause = String(formData.get("faultCause") ?? "").trim() || null;
    let countermeasure =
      String(formData.get("countermeasure") ?? "").trim() || null;
    const responsibilityRaw = String(formData.get("responsibility") ?? "");
    const responsibility = [
      "equipment",
      "operation",
      "process",
      "vendor",
      "other",
    ].includes(responsibilityRaw)
      ? (responsibilityRaw as
          | "equipment"
          | "operation"
          | "process"
          | "vendor"
          | "other")
      : wo.responsibility;
    const affectedRaw = String(formData.get("affectedOutput") ?? "").trim();
    const affectedNumber = Number(affectedRaw);
    const affectedOutput =
      affectedRaw === "" || !Number.isFinite(affectedNumber)
        ? null
        : Math.max(0, Math.round(affectedNumber));

    if (faultCodeId) {
      const [matched] = await db
        .select()
        .from(faultCodes)
        .where(eq(faultCodes.id, faultCodeId))
        .limit(1);
      if (matched) {
        faultCode = faultCode ?? matched.code;
        faultPhenomenon = faultPhenomenon ?? matched.phenomenon;
        faultCause = faultCause ?? matched.cause;
        countermeasure = countermeasure ?? matched.countermeasure;
      }
    }

    await db
      .update(workOrders)
      .set({
        faultCodeId,
        faultCode,
        faultPhenomenon,
        faultCause,
        countermeasure,
        responsibility,
        affectedOutput,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));

    await db
      .update(downtimeRecords)
      .set({ faultCodeId, responsibility, affectedOutput })
      .where(eq(downtimeRecords.workOrderId, id));

    await logEvent(
      id,
      wo.status,
      wo.status,
      `补充故障分析：${faultCode ?? "未分类"}${
        affectedOutput !== null ? `，影响产量 ${affectedOutput}` : ""
      }`,
      user.id,
    );
    await auditWo(id, "work_order.fault", user, {
      faultCode,
      faultCodeId,
      responsibility,
      affectedOutput,
    });
    revalidatePath("/app/faults");
  }

  if (op === "accept") {
    if (!canManage(user.role)) return;
    await db
      .update(workOrders)
      .set({
        status: "completed",
        completedAt: wo.completedAt ?? now,
        acceptedById: user.id,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));
    await syncAssetStatus(wo.assetId, "in_service");
    await logEvent(id, wo.status, "completed", "验收通过", user.id);
    await auditWo(id, "work_order.accept", user);
  }

  if (op === "close") {
    if (!canManage(user.role)) return;
    await db
      .update(workOrders)
      .set({ status: "closed", closedAt: now, updatedAt: now })
      .where(eq(workOrders.id, id));
    await syncAssetStatus(wo.assetId, "in_service");
    await logEvent(id, wo.status, "closed", "关闭归档", user.id);
    await auditWo(id, "work_order.close", user);
  }

  if (op === "reopen") {
    if (!canManage(user.role)) return;
    await db
      .update(workOrders)
      .set({
        status: "in_progress",
        completedAt: null,
        closedAt: null,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));
    await syncAssetStatus(wo.assetId, "repairing");
    await logEvent(id, wo.status, "in_progress", "验收不通过，退回返修", user.id);
    await auditWo(id, "work_order.reopen", user);
  }

  if (op === "cancel") {
    if (!canManage(user.role)) return;
    await db
      .update(workOrders)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(workOrders.id, id));
    await syncAssetStatus(wo.assetId, "in_service");
    await logEvent(id, wo.status, "cancelled", "工单取消", user.id);
    await auditWo(id, "work_order.cancel", user);
  }

  if (op === "addPart") {
    if (!canRepair(user.role)) return;
    if (wo.status === "closed" || wo.status === "cancelled") return;
    const partId = String(formData.get("partId") ?? "").trim();
    const quantityRaw = Number(formData.get("quantity") ?? 1);
    const quantity =
      Number.isFinite(quantityRaw) && quantityRaw >= 1
        ? Math.round(quantityRaw)
        : 1;
    const note = String(formData.get("note") ?? "").trim() || null;

    if (partId) {
      const [part] = await db
        .select()
        .from(spareParts)
        .where(eq(spareParts.id, partId))
        .limit(1);
      if (!part) return;
      if (part.stockQty < quantity) {
        redirect(`/app/work-orders/${id}?error=stock`);
      }
      const unitCost = Number(part.referencePrice ?? 0);
      const batchId = await consumeBatches(partId, quantity);

      await db
        .update(spareParts)
        .set({
          stockQty: sql`${spareParts.stockQty} - ${quantity}`,
          updatedAt: now,
        })
        .where(eq(spareParts.id, partId));

      await db.insert(workOrderParts).values({
        workOrderId: id,
        partId,
        name: part.name,
        quantity,
        unit: part.unit,
        unitPrice: money(unitCost),
        amount: money(unitCost * quantity),
        note,
      });

      await db.insert(inventoryTransactions).values({
        partId,
        batchId,
        type: "out",
        quantity,
        unitCost: money(unitCost),
        amount: money(unitCost * quantity),
        fromWarehouseId: part.warehouseId,
        workOrderId: id,
        assetId: wo.assetId,
        operatorId: user.id,
        operatorName: user.name,
        note: `工单领用 ${wo.code}`,
      });

      await logEvent(
        id,
        wo.status,
        wo.status,
        `领用备件：${part.name} × ${quantity}${part.unit}（库存扣减）`,
        user.id,
      );
      await auditWo(id, "work_order.part_issue", user, {
        partId,
        quantity,
      });
    } else {
      const name = String(formData.get("name") ?? "").trim();
      if (!name) return;
      const unit = String(formData.get("unit") ?? "").trim() || null;
      await db.insert(workOrderParts).values({
        workOrderId: id,
        name,
        quantity,
        unit,
        note,
      });
      await logEvent(
        id,
        wo.status,
        wo.status,
        `记录临时用料：${name} × ${quantity}${unit ?? ""}`,
        user.id,
      );
      await auditWo(id, "work_order.part_text", user, { name, quantity });
    }
  }

  if (op === "returnPart") {
    if (!canRepair(user.role)) return;
    const lineId = String(formData.get("partId") ?? "");
    if (!lineId) return;
    const [line] = await db
      .select()
      .from(workOrderParts)
      .where(
        and(eq(workOrderParts.id, lineId), eq(workOrderParts.workOrderId, id)),
      )
      .limit(1);
    if (!line) return;

    if (line.partId) {
      const [part] = await db
        .select()
        .from(spareParts)
        .where(eq(spareParts.id, line.partId))
        .limit(1);
      if (part) {
        const unitCost = Number(line.unitPrice ?? part.referencePrice ?? 0);
        const [batch] = await db
          .insert(partBatches)
          .values({
            partId: part.id,
            warehouseId: part.warehouseId,
            batchNo: makeCode("RTN"),
            quantity: line.quantity,
            unitCost: money(unitCost),
          })
          .returning({ id: partBatches.id });

        await db
          .update(spareParts)
          .set({
            stockQty: sql`${spareParts.stockQty} + ${line.quantity}`,
            updatedAt: now,
          })
          .where(eq(spareParts.id, part.id));

        await db.insert(inventoryTransactions).values({
          partId: part.id,
          batchId: batch.id,
          type: "return",
          quantity: line.quantity,
          unitCost: money(unitCost),
          amount: money(unitCost * line.quantity),
          toWarehouseId: part.warehouseId,
          workOrderId: id,
          assetId: wo.assetId,
          operatorId: user.id,
          operatorName: user.name,
          note: `工单退料 ${wo.code}`,
        });
      }
    }

    await db
      .delete(workOrderParts)
      .where(
        and(eq(workOrderParts.id, lineId), eq(workOrderParts.workOrderId, id)),
      );
    await logEvent(
      id,
      wo.status,
      wo.status,
      `退回备件：${line.name} × ${line.quantity}`,
      user.id,
    );
    await auditWo(id, "work_order.part_return", user, {
      partId: line.partId,
      quantity: line.quantity,
    });
  }

  if (op === "addPhotos") {
    if (!canRepair(user.role)) return;
    const saved = await saveUploads(pickUploads(formData), "work_order", id);
    if (saved > 0) {
      await logEvent(
        id,
        wo.status,
        wo.status,
        `上传 ${saved} 张维修照片`,
        user.id,
      );
    }
  }

  revalidatePath("/app/work-orders");
  revalidatePath(`/app/work-orders/${id}`);
  revalidatePath("/app/dashboard");
  revalidatePath(`/app/assets/${wo.assetId}`);
  revalidatePath("/app/spare-parts");
  revalidatePath("/app/spare-parts/transactions");
  redirect(`/app/work-orders/${id}`);
}

export async function moveWorkOrder(id: string, toStatus: string) {
  const user = await requireUser();
  const [wo] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!wo) return { ok: false, error: "工单不存在" };

  if (!WO_TRANSITIONS[wo.status]?.includes(toStatus)) {
    return { ok: false, error: `不能从「${WO_STATUS[wo.status].label}」直接流转到该状态` };
  }

  const now = new Date();

  if (toStatus === "assigned") {
    if (!canRepair(user.role)) return { ok: false, error: "没有派工权限" };
    await db
      .update(workOrders)
      .set({ status: "assigned", assigneeId: wo.assigneeId ?? user.id, updatedAt: now })
      .where(eq(workOrders.id, id));
    await logEvent(id, wo.status, "assigned", "看板流转：已派工", user.id);
  } else if (toStatus === "in_progress") {
    if (!canRepair(user.role)) return { ok: false, error: "没有开始维修的权限" };
    await db
      .update(workOrders)
      .set({
        status: "in_progress",
        startedAt: wo.startedAt ?? now,
        assigneeId: wo.assigneeId ?? user.id,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));
    await syncAssetStatus(wo.assetId, "repairing");
    await logEvent(id, wo.status, "in_progress", "看板流转：开始维修", user.id);
  } else if (toStatus === "pending_acceptance") {
    if (!canRepair(user.role)) return { ok: false, error: "没有提交验收的权限" };
    await db
      .update(workOrders)
      .set({
        status: "pending_acceptance",
        resolution: wo.resolution ?? "现场处理完成，等待验收。",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));
    await logEvent(id, wo.status, "pending_acceptance", "看板流转：提交验收", user.id);
  } else if (toStatus === "completed") {
    if (!canManage(user.role)) return { ok: false, error: "只有主管可以验收" };
    await db
      .update(workOrders)
      .set({
        status: "completed",
        completedAt: wo.completedAt ?? now,
        acceptedById: user.id,
        updatedAt: now,
      })
      .where(eq(workOrders.id, id));
    await syncAssetStatus(wo.assetId, "in_service");
    await logEvent(id, wo.status, "completed", "看板流转：验收通过", user.id);
  } else if (toStatus === "closed") {
    if (!canManage(user.role)) return { ok: false, error: "只有主管可以关闭归档" };
    await db
      .update(workOrders)
      .set({ status: "closed", closedAt: now, updatedAt: now })
      .where(eq(workOrders.id, id));
    await syncAssetStatus(wo.assetId, "in_service");
    await logEvent(id, wo.status, "closed", "看板流转：关闭归档", user.id);
  }

  await auditWo(id, "work_order.move", user, { toStatus });

  revalidatePath("/app/work-orders");
  revalidatePath(`/app/work-orders/${id}`);
  revalidatePath("/app/dashboard");
  revalidatePath(`/app/assets/${wo.assetId}`);
  return { ok: true };
}
