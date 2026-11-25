"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  assetDocuments,
  assetStatusHistory,
  assets,
  users,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { newToken } from "@/lib/qr";
import { saveDocumentUploads } from "@/lib/uploads";

export type AssetFormState = { error?: string };

const LEVELS = ["factory", "workshop", "line", "machine", "component"] as const;
const STATUSES = [
  "in_service",
  "idle",
  "fault",
  "repairing",
  "maintenance",
  "stopped",
  "retired",
] as const;

function parseDate(value: FormDataEntryValue | null) {
  if (!value || String(value).trim() === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseSpecs(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const specs: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [rawKey, ...rest] = line.split(/[=:：]/);
    const key = rawKey?.trim();
    const val = rest.join(":").trim();
    if (key && val) specs[key] = val;
  }
  return Object.keys(specs).length ? specs : null;
}

function asLevel(value: FormDataEntryValue | null) {
  const raw = String(value ?? "machine");
  return (LEVELS as readonly string[]).includes(raw)
    ? (raw as (typeof LEVELS)[number])
    : "machine";
}

function asStatus(value: FormDataEntryValue | null) {
  const raw = String(value ?? "in_service");
  return (STATUSES as readonly string[]).includes(raw)
    ? (raw as (typeof STATUSES)[number])
    : "in_service";
}

export async function createAsset(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const user = await requireUser();
  if (!canManage(user.role)) return { error: "没有新增设备的权限" };

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const level = asLevel(formData.get("level"));
  const parentId = String(formData.get("parentId") ?? "") || null;
  const locationId = String(formData.get("locationId") ?? "") || null;
  const installLocation =
    String(formData.get("installLocation") ?? "").trim() || null;
  const responsibleName =
    String(formData.get("responsibleName") ?? "").trim() || null;
  const manufacturer = String(formData.get("manufacturer") ?? "").trim() || null;
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const serialNo = String(formData.get("serialNo") ?? "").trim() || null;
  const criticality = String(formData.get("criticality") ?? "B") as
    | "A"
    | "B"
    | "C";
  const status = asStatus(formData.get("status"));
  const purchaseCostRaw = String(formData.get("purchaseCost") ?? "").trim();
  const depreciationRaw = String(formData.get("depreciationMonths") ?? "").trim();
  const depreciationMonths = depreciationRaw ? Number(depreciationRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!code || !name || !category) {
    return { error: "设备编码、名称和类别为必填项" };
  }

  try {
    const [created] = await db
      .insert(assets)
      .values({
        code,
        name,
        category,
        level,
        parentId,
        locationId,
        installLocation,
        responsibleName,
        manufacturer,
        vendor,
        model,
        serialNo,
        criticality,
        status,
        purchaseDate: parseDate(formData.get("purchaseDate")),
        warrantyUntil: parseDate(formData.get("warrantyUntil")),
        purchaseCost: purchaseCostRaw || null,
        depreciationMonths:
          depreciationMonths !== null && Number.isFinite(depreciationMonths)
            ? Math.round(depreciationMonths)
            : null,
        specs: parseSpecs(formData.get("specs")),
        notes,
        qrToken: newToken(),
      })
      .returning({ id: assets.id });

    await db.insert(assetStatusHistory).values({
      assetId: created.id,
      fromStatus: null,
      toStatus: status,
      reason: "建档初始状态",
      source: "create",
      actorId: user.id,
    });
    await audit({
      entityType: "asset",
      entityId: created.id,
      action: "asset.create",
      detail: { code, name, level },
      actorId: user.id,
      actorName: user.name,
    });

    revalidatePath("/app/assets");
    revalidatePath("/admin/assets/tree");
    revalidatePath("/app/dashboard");
    redirect(`/app/assets/${created.id}`);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return { error: "设备编码已存在，请换一个" };
    }
    throw error;
  }
}

/** 设备树快速新增节点：成功后回到设备树页面。 */
export async function createAssetNode(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const level = asLevel(formData.get("level"));
  const parentId = String(formData.get("parentId") ?? "") || null;
  if (!code || !name) return;

  const [created] = await db
    .insert(assets)
    .values({
      code,
      name,
      category: String(formData.get("category") ?? "其他").trim() || "其他",
      level,
      parentId,
      responsibleName:
        String(formData.get("responsibleName") ?? "").trim() || null,
      qrToken: newToken(),
    })
    .returning({ id: assets.id });

  await db.insert(assetStatusHistory).values({
    assetId: created.id,
    fromStatus: null,
    toStatus: "in_service",
    reason: "设备树新建节点",
    source: "create",
    actorId: user.id,
  });
  await audit({
    entityType: "asset",
    entityId: created.id,
    action: "asset.create",
    detail: { code, name, level, parentId },
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath("/app/assets");
  revalidatePath("/admin/assets/tree");
  redirect("/admin/assets/tree");
}

/** 移动设备树节点，写入审计；禁止移动到自身或自己的子节点下。 */
export async function moveAsset(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  const rawParent = String(formData.get("parentId") ?? "");
  const parentId = rawParent === "" ? null : rawParent;
  const reason = String(formData.get("reason") ?? "").trim() || "调整层级";
  if (!id || parentId === id) return;

  if (parentId) {
    let cursor: string | null = parentId;
    for (let guard = 0; cursor && guard < 20; guard += 1) {
      if (cursor === id) return;
      const [parent] = await db
        .select({ parentId: assets.parentId })
        .from(assets)
        .where(eq(assets.id, cursor))
        .limit(1);
      cursor = parent?.parentId ?? null;
    }
  }

  const [asset] = await db
    .select({ id: assets.id, name: assets.name, parentId: assets.parentId })
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);
  if (!asset) return;

  await db
    .update(assets)
    .set({ parentId, updatedAt: new Date() })
    .where(eq(assets.id, id));
  await audit({
    entityType: "asset",
    entityId: id,
    action: "asset.move",
    detail: { from: asset.parentId, to: parentId, reason },
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath("/app/assets");
  revalidatePath("/admin/assets/tree");
  revalidatePath(`/app/assets/${id}`);
  redirect("/admin/assets/tree");
}

export async function updateAssetStatus(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;
  const id = String(formData.get("id") ?? "");
  const status = asStatus(formData.get("status"));
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!id) return;

  const [asset] = await db
    .select({ status: assets.status, name: assets.name })
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);
  if (!asset || asset.status === status) return;

  await db
    .update(assets)
    .set({ status, updatedAt: new Date() })
    .where(eq(assets.id, id));

  await db.insert(assetStatusHistory).values({
    assetId: id,
    fromStatus: asset.status,
    toStatus: status,
    reason,
    source: "manual",
    actorId: user.id,
  });
  await audit({
    entityType: "asset",
    entityId: id,
    action: "asset.status",
    detail: { from: asset.status, to: status, reason },
    actorId: user.id,
    actorName: user.name,
  });

  if (status === "fault") {
    const managers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.active, true),
          inArray(users.role, ["admin", "manager"]),
        ),
      );
    for (const manager of managers) {
      await notify(
        manager.id,
        `设备故障：${asset.name}`,
        reason ?? "设备状态已切换为故障，请安排处理。",
        `/app/assets/${id}`,
      );
    }
  }

  revalidatePath(`/app/assets/${id}`);
  revalidatePath("/app/assets");
  revalidatePath("/admin/assets/tree");
  revalidatePath("/app/dashboard");
  redirect(`/app/assets/${id}?tab=history`);
}

export type AssetProfileState = { error?: string; ok?: boolean };

/** 更新一机一档基础信息、技术参数、折旧信息。 */
export async function updateAssetProfile(
  _prev: AssetProfileState,
  formData: FormData,
): Promise<AssetProfileState> {
  const user = await requireUser();
  if (!canManage(user.role)) return { error: "没有编辑设备的权限" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "设备不存在" };

  const purchaseCostRaw = String(formData.get("purchaseCost") ?? "").trim();
  const depreciationRaw = String(formData.get("depreciationMonths") ?? "").trim();
  const depreciationMonths = depreciationRaw ? Number(depreciationRaw) : null;

  await db
    .update(assets)
    .set({
      installLocation:
        String(formData.get("installLocation") ?? "").trim() || null,
      responsibleName:
        String(formData.get("responsibleName") ?? "").trim() || null,
      vendor: String(formData.get("vendor") ?? "").trim() || null,
      purchaseCost: purchaseCostRaw || null,
      depreciationMonths:
        depreciationMonths !== null && Number.isFinite(depreciationMonths)
          ? Math.round(depreciationMonths)
          : null,
      specs: parseSpecs(formData.get("specs")),
      notes: String(formData.get("notes") ?? "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, id));

  await audit({
    entityType: "asset",
    entityId: id,
    action: "asset.profile",
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath(`/app/assets/${id}`);
  revalidatePath("/app/assets");
  return { ok: true };
}

export async function addAssetDocument(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const assetId = String(formData.get("assetId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "manual");
  const note = String(formData.get("note") ?? "").trim() || null;
  const file = formData.get("file");
  if (!assetId || !name || !(file instanceof File) || !file.size) return;

  const [saved] = await saveDocumentUploads(
    [file],
    "asset_document",
    assetId,
  );
  if (!saved) return;

  await db.insert(assetDocuments).values({
    assetId,
    name,
    category,
    attachmentId: saved.id,
    note,
  });
  await audit({
    entityType: "asset",
    entityId: assetId,
    action: "asset.document",
    detail: { name, category },
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath(`/app/assets/${assetId}`);
}

export async function deleteAssetDocument(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  if (!id || !assetId) return;

  await db.delete(assetDocuments).where(eq(assetDocuments.id, id));
  await audit({
    entityType: "asset",
    entityId: assetId,
    action: "asset.document.delete",
    detail: { documentId: id },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePath(`/app/assets/${assetId}`);
}
