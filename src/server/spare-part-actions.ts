"use server";

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  assetBom,
  inventoryTransactions,
  partBatches,
  purchaseRequestItems,
  purchaseRequests,
  spareParts,
  stocktakeItems,
  stocktakes,
  users,
  warehouses,
  workOrderEvents,
  workOrderParts,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { makeCode } from "@/lib/utils";

function int(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function revalidateParts(partId?: string) {
  revalidatePath("/app/spare-parts");
  revalidatePath("/app/spare-parts/transactions");
  revalidatePath("/app/spare-parts/purchase-requests");
  revalidatePath("/admin/spare-parts/stocktake");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/assets");
  if (partId) revalidatePath(`/app/spare-parts/${partId}`);
}

async function auditPart(
  partId: string,
  action: string,
  actor: { id: string; name: string },
  detail?: Record<string, unknown>,
) {
  await audit({
    entityType: "spare_part",
    entityId: partId,
    action,
    detail,
    actorId: actor.id,
    actorName: actor.name,
  });
}

async function consumeBatches(
  partId: string,
  quantity: number,
  warehouseId?: string | null,
) {
  const conditions = [
    eq(partBatches.partId, partId),
    gt(partBatches.quantity, 0),
  ];
  if (warehouseId) conditions.push(eq(partBatches.warehouseId, warehouseId));

  const batches = await db
    .select()
    .from(partBatches)
    .where(and(...conditions))
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

export async function createWarehouse(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || makeCode("WH");
  if (!name) return;

  const [created] = await db
    .insert(warehouses)
    .values({
      name,
      code,
      address: String(formData.get("address") ?? "").trim() || null,
      managerName: String(formData.get("managerName") ?? "").trim() || null,
    })
    .returning({ id: warehouses.id });

  await audit({
    entityType: "warehouse",
    entityId: created.id,
    action: "warehouse.create",
    detail: { name, code },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePath("/app/spare-parts");
}

export async function createSparePart(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const referencePrice = Number(formData.get("referencePrice") ?? 0);
  const [created] = await db
    .insert(spareParts)
    .values({
      code: String(formData.get("code") ?? "").trim() || makeCode("SP"),
      name,
      category: String(formData.get("category") ?? "通用").trim() || "通用",
      spec: String(formData.get("spec") ?? "").trim() || null,
      unit: String(formData.get("unit") ?? "件").trim() || "件",
      brand: String(formData.get("brand") ?? "").trim() || null,
      supplier: String(formData.get("supplier") ?? "").trim() || null,
      warehouseId: String(formData.get("warehouseId") ?? "") || null,
      binCode: String(formData.get("binCode") ?? "").trim() || null,
      safetyStock: Math.max(0, int(formData.get("safetyStock"), 0)),
      referencePrice: Number.isFinite(referencePrice)
        ? money(referencePrice)
        : "0.00",
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .returning({ id: spareParts.id });

  await auditPart(created.id, "spare_part.create", user, { name });
  revalidateParts(created.id);
  redirect(`/app/spare-parts/${created.id}`);
}

export async function updateSparePart(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [part] = await db
    .select()
    .from(spareParts)
    .where(eq(spareParts.id, id))
    .limit(1);
  if (!part) return;

  const referencePrice = Number(formData.get("referencePrice") ?? 0);
  await db
    .update(spareParts)
    .set({
      name: String(formData.get("name") ?? part.name).trim() || part.name,
      category: String(formData.get("category") ?? part.category),
      spec: String(formData.get("spec") ?? "").trim() || null,
      unit: String(formData.get("unit") ?? part.unit).trim() || part.unit,
      brand: String(formData.get("brand") ?? "").trim() || null,
      supplier: String(formData.get("supplier") ?? "").trim() || null,
      warehouseId: String(formData.get("warehouseId") ?? "") || null,
      binCode: String(formData.get("binCode") ?? "").trim() || null,
      safetyStock: Math.max(0, int(formData.get("safetyStock"), part.safetyStock)),
      referencePrice: Number.isFinite(referencePrice)
        ? money(referencePrice)
        : part.referencePrice,
      active: formData.get("active") === "on",
      notes: String(formData.get("notes") ?? "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(spareParts.id, id));

  await auditPart(id, "spare_part.update", user);
  revalidateParts(id);
  redirect(`/app/spare-parts/${id}`);
}

export async function receiveStock(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const partId = String(formData.get("partId") ?? "");
  const quantity = int(formData.get("quantity"), 0);
  if (!partId || quantity <= 0) return;

  const [part] = await db
    .select()
    .from(spareParts)
    .where(eq(spareParts.id, partId))
    .limit(1);
  if (!part) return;

  const costRaw = Number(formData.get("unitCost") ?? 0);
  const unitCost = Number.isFinite(costRaw) && costRaw > 0
    ? costRaw
    : Number(part.referencePrice ?? 0);
  const batchNo =
    String(formData.get("batchNo") ?? "").trim() || makeCode("B");
  const expiryRaw = String(formData.get("expiryAt") ?? "");
  const expiryAt = expiryRaw ? new Date(`${expiryRaw}T00:00:00`) : null;

  const [batch] = await db
    .insert(partBatches)
    .values({
      partId,
      warehouseId: part.warehouseId,
      batchNo,
      quantity,
      unitCost: money(unitCost),
      expiryAt: expiryAt && !Number.isNaN(expiryAt.getTime()) ? expiryAt : null,
    })
    .returning({ id: partBatches.id });

  await db
    .update(spareParts)
    .set({
      stockQty: sql`${spareParts.stockQty} + ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(spareParts.id, partId));

  await db.insert(inventoryTransactions).values({
    partId,
    batchId: batch.id,
    type: "in",
    quantity,
    unitCost: money(unitCost),
    amount: money(unitCost * quantity),
    toWarehouseId: part.warehouseId,
    operatorId: user.id,
    operatorName: user.name,
    note: String(formData.get("note") ?? "").trim() || `入库批次 ${batchNo}`,
  });

  await auditPart(partId, "spare_part.receive", user, {
    quantity,
    batchNo,
  });
  revalidateParts(partId);
  redirect(`/app/spare-parts/${partId}?ok=in`);
}

export async function issueStock(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const partId = String(formData.get("partId") ?? "");
  const quantity = int(formData.get("quantity"), 0);
  if (!partId || quantity <= 0) return;

  const [part] = await db
    .select()
    .from(spareParts)
    .where(eq(spareParts.id, partId))
    .limit(1);
  if (!part) return;
  if (part.stockQty < quantity) {
    redirect(`/app/spare-parts/${partId}?error=stock`);
  }

  const unitCost = Number(part.referencePrice ?? 0);
  const batchId = await consumeBatches(partId, quantity);

  await db
    .update(spareParts)
    .set({
      stockQty: sql`${spareParts.stockQty} - ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(spareParts.id, partId));

  await db.insert(inventoryTransactions).values({
    partId,
    batchId,
    type: "out",
    quantity,
    unitCost: money(unitCost),
    amount: money(unitCost * quantity),
    fromWarehouseId: part.warehouseId,
    operatorId: user.id,
    operatorName: user.name,
    note: String(formData.get("note") ?? "").trim() || "现场领用",
  });

  await auditPart(partId, "spare_part.issue", user, { quantity });
  revalidateParts(partId);
  redirect(`/app/spare-parts/${partId}?ok=out`);
}

export async function mobileIssuePart(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const token = String(formData.get("token") ?? "");
  const quantity = int(formData.get("quantity"), 0);
  const workOrderId = String(formData.get("workOrderId") ?? "") || null;
  if (!token || quantity <= 0) return;

  const [part] = await db
    .select()
    .from(spareParts)
    .where(eq(spareParts.qrToken, token))
    .limit(1);
  if (!part) return;
  if (!part.active) {
    redirect(`/m/spare-parts/${token}?error=inactive`);
  }
  if (part.stockQty < quantity) {
    redirect(`/m/spare-parts/${token}?error=stock`);
  }

  let wo: typeof workOrders.$inferSelect | null = null;
  if (workOrderId) {
    const [row] = await db
      .select()
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId))
      .limit(1);
    if (!row || row.status === "closed" || row.status === "cancelled") {
      redirect(`/m/spare-parts/${token}?error=wo`);
    }
    wo = row;
  }

  const unitCost = Number(part.referencePrice ?? 0);
  const batchId = await consumeBatches(part.id, quantity);

  await db
    .update(spareParts)
    .set({
      stockQty: sql`${spareParts.stockQty} - ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(spareParts.id, part.id));

  await db.insert(inventoryTransactions).values({
    partId: part.id,
    batchId,
    type: "out",
    quantity,
    unitCost: money(unitCost),
    amount: money(unitCost * quantity),
    fromWarehouseId: part.warehouseId,
    workOrderId: wo?.id ?? null,
    assetId: wo?.assetId ?? null,
    operatorId: user.id,
    operatorName: user.name,
    note:
      String(formData.get("note") ?? "").trim() ||
      (wo ? `工单领用 ${wo.code}` : "扫码领用"),
  });

  if (wo) {
    await db.insert(workOrderParts).values({
      workOrderId: wo.id,
      partId: part.id,
      name: part.name,
      quantity,
      unit: part.unit,
      unitPrice: money(unitCost),
      amount: money(unitCost * quantity),
      note: "扫码领用",
    });
    await db.insert(workOrderEvents).values({
      workOrderId: wo.id,
      fromStatus: wo.status,
      toStatus: wo.status,
      note: `扫码领用备件：${part.name} × ${quantity}${part.unit}（库存扣减）`,
      actorId: user.id,
    });
    await audit({
      entityType: "work_order",
      entityId: wo.id,
      action: "work_order.part_issue",
      detail: { partId: part.id, quantity, source: "qr" },
      actorId: user.id,
      actorName: user.name,
    });
    revalidatePath("/app/work-orders");
    revalidatePath(`/app/work-orders/${wo.id}`);
    revalidatePath(`/m/work-orders/${wo.id}`);
  }

  await auditPart(part.id, "spare_part.mobile_issue", user, {
    quantity,
    workOrderId: wo?.id ?? null,
  });
  revalidateParts(part.id);
  revalidatePath(`/m/spare-parts/${token}`);

  const remaining = part.stockQty - quantity;
  const params = new URLSearchParams({ ok: "1", qty: String(quantity) });
  params.set("stock", String(remaining));
  if (wo) params.set("wo", wo.id);
  redirect(`/m/spare-parts/${token}?${params.toString()}`);
}

export async function returnStock(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const partId = String(formData.get("partId") ?? "");
  const quantity = int(formData.get("quantity"), 0);
  if (!partId || quantity <= 0) return;

  const [part] = await db
    .select()
    .from(spareParts)
    .where(eq(spareParts.id, partId))
    .limit(1);
  if (!part) return;

  const unitCost = Number(part.referencePrice ?? 0);
  const batchNo = makeCode("RTN");
  const [batch] = await db
    .insert(partBatches)
    .values({
      partId,
      warehouseId: part.warehouseId,
      batchNo,
      quantity,
      unitCost: money(unitCost),
    })
    .returning({ id: partBatches.id });

  await db
    .update(spareParts)
    .set({
      stockQty: sql`${spareParts.stockQty} + ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(spareParts.id, partId));

  await db.insert(inventoryTransactions).values({
    partId,
    batchId: batch.id,
    type: "return",
    quantity,
    unitCost: money(unitCost),
    amount: money(unitCost * quantity),
    toWarehouseId: part.warehouseId,
    operatorId: user.id,
    operatorName: user.name,
    note: String(formData.get("note") ?? "").trim() || "退料回库",
  });

  await auditPart(partId, "spare_part.return", user, { quantity });
  revalidateParts(partId);
  redirect(`/app/spare-parts/${partId}?ok=return`);
}

export async function transferStock(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const partId = String(formData.get("partId") ?? "");
  const toWarehouseId = String(formData.get("toWarehouseId") ?? "");
  const quantity = int(formData.get("quantity"), 0);
  if (!partId || !toWarehouseId || quantity <= 0) return;

  const [part] = await db
    .select()
    .from(spareParts)
    .where(eq(spareParts.id, partId))
    .limit(1);
  if (!part) return;
  if (part.stockQty < quantity) {
    redirect(`/app/spare-parts/${partId}?error=stock`);
  }
  if (part.warehouseId === toWarehouseId) {
    redirect(`/app/spare-parts/${partId}?error=warehouse`);
  }

  const [target] = await db
    .select({ name: warehouses.name })
    .from(warehouses)
    .where(eq(warehouses.id, toWarehouseId))
    .limit(1);
  if (!target) return;

  const unitCost = Number(part.referencePrice ?? 0);
  const batchId = await consumeBatches(partId, quantity);

  await db.insert(partBatches).values({
    partId,
    warehouseId: toWarehouseId,
    batchNo: makeCode("TRF"),
    quantity,
    unitCost: money(unitCost),
  });

  await db.insert(inventoryTransactions).values({
    partId,
    batchId,
    type: "transfer",
    quantity,
    unitCost: money(unitCost),
    amount: money(unitCost * quantity),
    fromWarehouseId: part.warehouseId,
    toWarehouseId,
    operatorId: user.id,
    operatorName: user.name,
    note:
      String(formData.get("note") ?? "").trim() ||
      `调拨至 ${target.name}`,
  });

  await auditPart(partId, "spare_part.transfer", user, {
    quantity,
    toWarehouseId,
  });
  revalidateParts(partId);
  redirect(`/app/spare-parts/${partId}?ok=transfer`);
}

export async function saveBom(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const assetId = String(formData.get("assetId") ?? "");
  const partId = String(formData.get("partId") ?? "");
  const quantity = Math.max(1, int(formData.get("quantity"), 1));
  if (!assetId || !partId) return;

  const [existing] = await db
    .select({ id: assetBom.id })
    .from(assetBom)
    .where(and(eq(assetBom.assetId, assetId), eq(assetBom.partId, partId)))
    .limit(1);

  if (existing) {
    await db
      .update(assetBom)
      .set({ quantity })
      .where(eq(assetBom.id, existing.id));
  } else {
    await db.insert(assetBom).values({
      assetId,
      partId,
      quantity,
      note: String(formData.get("note") ?? "").trim() || null,
    });
  }

  await auditPart(partId, "spare_part.bom", user, { assetId, quantity });
  revalidateParts(partId);
  revalidatePath(`/app/assets/${assetId}`);
  redirect(`/app/spare-parts/${partId}?ok=bom`);
}

export async function removeBom(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  const partId = String(formData.get("partId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  if (!id) return;

  await db.delete(assetBom).where(eq(assetBom.id, id));
  await auditPart(partId, "spare_part.bom_remove", user, { assetId });
  revalidateParts(partId);
  if (assetId) revalidatePath(`/app/assets/${assetId}`);
  redirect(`/app/spare-parts/${partId}?ok=bom`);
}

async function notifyApprovers(
  code: string,
  actor: { id: string; name: string },
) {
  const approvers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, ["admin", "manager"])));
  for (const row of approvers) {
    if (row.id === actor.id) continue;
    await notify(
      row.id,
      "采购申请待审批",
      `${actor.name} 提交了 ${code}，请及时审批。`,
      "/app/spare-parts/purchase-requests?status=submitted",
    );
  }
}

export async function createPurchaseRequest(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const partId = String(formData.get("partId") ?? "");
  const quantity = Math.max(1, int(formData.get("quantity"), 1));
  if (!partId) return;

  const [part] = await db
    .select()
    .from(spareParts)
    .where(eq(spareParts.id, partId))
    .limit(1);
  if (!part) return;

  const neededRaw = String(formData.get("neededAt") ?? "");
  const neededAt = neededRaw ? new Date(`${neededRaw}T18:00:00`) : null;
  const [created] = await db
    .insert(purchaseRequests)
    .values({
      code: makeCode("PR"),
      status: "draft",
      requestedById: user.id,
      neededAt: neededAt && !Number.isNaN(neededAt.getTime()) ? neededAt : null,
      note: String(formData.get("note") ?? "").trim() || null,
    })
    .returning({ id: purchaseRequests.id });

  await db.insert(purchaseRequestItems).values({
    requestId: created.id,
    partId,
    quantity,
    unitCost: part.referencePrice,
  });

  await audit({
    entityType: "purchase_request",
    entityId: created.id,
    action: "purchase_request.create",
    detail: { partId, quantity },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateParts(partId);
  redirect("/app/spare-parts/purchase-requests?ok=create");
}

export async function createLowStockPurchaseRequest() {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const lowRows = await db
    .select()
    .from(spareParts)
    .where(
      and(
        eq(spareParts.active, true),
        sql`${spareParts.stockQty} < ${spareParts.safetyStock}`,
      ),
    );

  if (lowRows.length === 0) {
    redirect("/app/spare-parts/purchase-requests?empty=1");
  }

  const [created] = await db
    .insert(purchaseRequests)
    .values({
      code: makeCode("PR"),
      status: "draft",
      requestedById: user.id,
      source: "auto_low_stock",
      note: "低库存自动补货建议",
    })
    .returning({ id: purchaseRequests.id });

  await db.insert(purchaseRequestItems).values(
    lowRows.map((part) => ({
      requestId: created.id,
      partId: part.id,
      quantity: Math.max(part.safetyStock - part.stockQty, 1),
      unitCost: part.referencePrice,
      note: "低于安全库存",
    })),
  );

  await audit({
    entityType: "purchase_request",
    entityId: created.id,
    action: "purchase_request.auto_low_stock",
    detail: { parts: lowRows.length },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateParts();
  redirect("/app/spare-parts/purchase-requests?ok=auto");
}

export async function updatePurchaseRequest(formData: FormData) {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const op = String(formData.get("op") ?? "");
  const base = "/app/spare-parts/purchase-requests";
  if (!id || !op) return;

  const [request] = await db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, id))
    .limit(1);
  if (!request) return;
  if (request.status === "arrived" || request.status === "cancelled") return;

  const approver = canManage(user.role);
  const isOwner = request.requestedById === user.id;
  const canHandle = approver || isOwner;
  const reason = String(formData.get("reason") ?? "").trim();

  if (op === "submit") {
    if (!canHandle) return;
    if (request.status !== "draft" && request.status !== "rejected") return;
    await db
      .update(purchaseRequests)
      .set({
        status: "submitted",
        approvedById: null,
        approvedAt: null,
        rejectedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(purchaseRequests.id, id));
    await notifyApprovers(request.code, user);
  }

  if (op === "withdraw") {
    if (!canHandle) return;
    if (request.status !== "submitted") return;
    await db
      .update(purchaseRequests)
      .set({
        status: "draft",
        approvedById: null,
        approvedAt: null,
        rejectedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(purchaseRequests.id, id));
  }

  if (op === "approve") {
    if (!approver) redirect(`${base}?error=perm`);
    if (request.status !== "submitted") return;
    await db
      .update(purchaseRequests)
      .set({
        status: "approved",
        approvedById: user.id,
        approvedAt: new Date(),
        rejectedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(purchaseRequests.id, id));
    await notify(
      request.requestedById,
      "采购申请已通过",
      `${request.code} 已由 ${user.name} 审批通过，可安排到货入库。`,
      base,
    );
  }

  if (op === "reject") {
    if (!approver) redirect(`${base}?error=perm`);
    if (request.status !== "submitted") return;
    if (!reason) redirect(`${base}?error=reason`);
    await db
      .update(purchaseRequests)
      .set({
        status: "rejected",
        approvedById: user.id,
        approvedAt: new Date(),
        rejectedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(purchaseRequests.id, id));
    await notify(
      request.requestedById,
      "采购申请被驳回",
      `${request.code} 被驳回：${reason}`,
      base,
    );
  }

  if (op === "arrive") {
    if (!approver) redirect(`${base}?error=perm`);
    if (request.status !== "approved") redirect(`${base}?error=not-approved`);

    const items = await db
      .select({
        item: purchaseRequestItems,
        part: spareParts,
      })
      .from(purchaseRequestItems)
      .innerJoin(spareParts, eq(purchaseRequestItems.partId, spareParts.id))
      .where(eq(purchaseRequestItems.requestId, id));

    for (const [index, row] of items.entries()) {
      const quantity = row.item.quantity;
      const unitCost = Number(row.item.unitCost ?? row.part.referencePrice ?? 0);
      const batchNo = `${request.code}-${String(index + 1).padStart(2, "0")}`;
      const [batch] = await db
        .insert(partBatches)
        .values({
          partId: row.part.id,
          warehouseId: row.part.warehouseId,
          batchNo,
          quantity,
          unitCost: money(unitCost),
        })
        .returning({ id: partBatches.id });

      await db
        .update(spareParts)
        .set({
          stockQty: sql`${spareParts.stockQty} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(spareParts.id, row.part.id));

      await db.insert(inventoryTransactions).values({
        partId: row.part.id,
        batchId: batch.id,
        type: "in",
        quantity,
        unitCost: money(unitCost),
        amount: money(unitCost * quantity),
        toWarehouseId: row.part.warehouseId,
        operatorId: user.id,
        operatorName: user.name,
        note: `采购到货 ${request.code}`,
      });
    }

    await db
      .update(purchaseRequests)
      .set({ status: "arrived", updatedAt: new Date() })
      .where(eq(purchaseRequests.id, id));
    await notify(
      request.requestedById,
      "采购申请已到货",
      `${request.code} 已到货入库，库存与批次已更新。`,
      base,
    );
  }

  if (op === "cancel") {
    if (!canHandle) return;
    await db
      .update(purchaseRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(purchaseRequests.id, id));
  }

  await audit({
    entityType: "purchase_request",
    entityId: id,
    action: `purchase_request.${op}`,
    detail: reason ? { reason } : undefined,
    actorId: user.id,
    actorName: user.name,
  });
  revalidateParts();
  redirect(`${base}?ok=${op}`);
}

export async function createStocktake(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const warehouseId = String(formData.get("warehouseId") ?? "");
  if (!warehouseId) return;

  const [created] = await db
    .insert(stocktakes)
    .values({
      code: makeCode("ST"),
      warehouseId,
      status: "counting",
      createdById: user.id,
      note: String(formData.get("note") ?? "").trim() || null,
    })
    .returning({ id: stocktakes.id });

  const parts = await db
    .select({
      id: spareParts.id,
      stockQty: sql<number>`coalesce(sum(${partBatches.quantity}), 0)`,
    })
    .from(partBatches)
    .innerJoin(spareParts, eq(partBatches.partId, spareParts.id))
    .where(
      and(eq(partBatches.warehouseId, warehouseId), eq(spareParts.active, true)),
    )
    .groupBy(spareParts.id)
    .orderBy(asc(spareParts.code));

  if (parts.length > 0) {
    await db.insert(stocktakeItems).values(
      parts.map((part) => ({
        stocktakeId: created.id,
        partId: part.id,
        systemQty: Number(part.stockQty),
      })),
    );
  }

  await audit({
    entityType: "stocktake",
    entityId: created.id,
    action: "stocktake.create",
    detail: { warehouseId, parts: parts.length },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateParts();
  redirect(`/admin/spare-parts/stocktake/${created.id}`);
}

export async function submitStocktake(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [sheet] = await db
    .select()
    .from(stocktakes)
    .where(eq(stocktakes.id, id))
    .limit(1);
  if (!sheet || sheet.status === "done") return;

  const items = await db
    .select({ item: stocktakeItems, part: spareParts })
    .from(stocktakeItems)
    .innerJoin(spareParts, eq(stocktakeItems.partId, spareParts.id))
    .where(eq(stocktakeItems.stocktakeId, id));

  for (const row of items) {
    const raw = formData.get(`counted_${row.item.id}`);
    if (raw === null || String(raw).trim() === "") continue;
    const countedQty = Math.max(0, int(raw, row.item.systemQty));
    const diff = countedQty - row.item.systemQty;

    await db
      .update(stocktakeItems)
      .set({
        countedQty,
        diff,
        note: String(formData.get(`note_${row.item.id}`) ?? "").trim() || null,
      })
      .where(eq(stocktakeItems.id, row.item.id));

    if (diff === 0) continue;

    if (diff > 0) {
      await db.insert(partBatches).values({
        partId: row.part.id,
        warehouseId: sheet.warehouseId,
        batchNo: makeCode("ADJ"),
        quantity: diff,
        unitCost: row.part.referencePrice,
      });
    } else {
      await consumeBatches(
        row.part.id,
        Math.abs(diff),
        sheet.warehouseId,
      );
    }

    await db
      .update(spareParts)
      .set({
        stockQty: sql`${spareParts.stockQty} + ${diff}`,
        updatedAt: new Date(),
      })
      .where(eq(spareParts.id, row.part.id));

    await db.insert(inventoryTransactions).values({
      partId: row.part.id,
      type: "adjust",
      quantity: Math.abs(diff),
      unitCost: row.part.referencePrice,
      amount: money(Number(row.part.referencePrice ?? 0) * Math.abs(diff)),
      operatorId: user.id,
      operatorName: user.name,
      note: `盘点 ${sheet.code} ${diff > 0 ? "盘盈" : "盘亏"} ${Math.abs(diff)} ${row.part.unit}`,
    });
  }

  await db
    .update(stocktakes)
    .set({ status: "done", completedAt: new Date() })
    .where(eq(stocktakes.id, id));

  await audit({
    entityType: "stocktake",
    entityId: id,
    action: "stocktake.done",
    actorId: user.id,
    actorName: user.name,
  });
  revalidateParts();
  redirect(`/admin/spare-parts/stocktake/${id}?ok=1`);
}
