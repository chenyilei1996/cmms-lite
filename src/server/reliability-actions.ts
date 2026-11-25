"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { downtimeRecords, faultCodes } from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { FAULT_CATEGORIES } from "@/lib/constants";

const RESPONSIBILITIES = [
  "equipment",
  "operation",
  "process",
  "vendor",
  "other",
] as const;

function int(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function revalidateReliability() {
  revalidatePath("/app/faults");
  revalidatePath("/admin/faults/codes");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/work-orders");
}

export async function createFaultCode(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) return;

  const [created] = await db
    .insert(faultCodes)
    .values({
      code,
      name,
      category: String(formData.get("category") ?? "机械"),
      phenomenon: String(formData.get("phenomenon") ?? "").trim() || null,
      cause: String(formData.get("cause") ?? "").trim() || null,
      countermeasure:
        String(formData.get("countermeasure") ?? "").trim() || null,
      severity: ["A", "B", "C"].includes(String(formData.get("severity")))
        ? (String(formData.get("severity")) as "A" | "B" | "C")
        : "B",
    })
    .returning({ id: faultCodes.id });

  await audit({
    entityType: "fault_code",
    entityId: created.id,
    action: "fault_code.create",
    detail: { code, name },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateReliability();
  redirect("/admin/faults/codes?ok=1");
}

export async function updateFaultCode(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [row] = await db
    .select()
    .from(faultCodes)
    .where(eq(faultCodes.id, id))
    .limit(1);
  if (!row) return;

  const category = String(formData.get("category") ?? row.category);
  await db
    .update(faultCodes)
    .set({
      name: String(formData.get("name") ?? row.name).trim() || row.name,
      category: FAULT_CATEGORIES.includes(category)
        ? category
        : row.category,
      phenomenon: String(formData.get("phenomenon") ?? "").trim() || null,
      cause: String(formData.get("cause") ?? "").trim() || null,
      countermeasure:
        String(formData.get("countermeasure") ?? "").trim() || null,
      severity: ["A", "B", "C"].includes(String(formData.get("severity")))
        ? (String(formData.get("severity")) as "A" | "B" | "C")
        : row.severity,
      active: formData.get("active") === "on",
      updatedAt: new Date(),
    })
    .where(eq(faultCodes.id, id));

  await audit({
    entityType: "fault_code",
    entityId: id,
    action: "fault_code.update",
    actorId: user.id,
    actorName: user.name,
  });
  revalidateReliability();
  redirect("/admin/faults/codes?ok=2");
}

export async function createDowntimeRecord(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const assetId = String(formData.get("assetId") ?? "");
  const startedRaw = String(formData.get("startedAt") ?? "");
  const endedRaw = String(formData.get("endedAt") ?? "");
  if (!assetId || !startedRaw) return;

  const startedAt = new Date(startedRaw);
  const endedAt = endedRaw ? new Date(endedRaw) : null;
  if (Number.isNaN(startedAt.getTime())) return;
  if (endedAt && Number.isNaN(endedAt.getTime())) return;
  if (endedAt && endedAt <= startedAt) {
    redirect("/app/faults?error=time");
  }

  const minutes = endedAt
    ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))
    : Math.max(0, int(formData.get("minutes"), 0));
  const type = ["planned", "unplanned"].includes(String(formData.get("type")))
    ? (String(formData.get("type")) as "planned" | "unplanned")
    : "unplanned";
  const responsibilityRaw = String(formData.get("responsibility") ?? "");
  const responsibility = (RESPONSIBILITIES as readonly string[]).includes(
    responsibilityRaw,
  )
    ? (responsibilityRaw as (typeof RESPONSIBILITIES)[number])
    : "equipment";
  const affectedRaw = String(formData.get("affectedOutput") ?? "");
  const affectedOutput =
    affectedRaw.trim() === "" ? null : Math.max(0, int(affectedRaw, 0));
  const workOrderId = String(formData.get("workOrderId") ?? "") || null;

  const values = {
    assetId,
    workOrderId,
    faultCodeId: String(formData.get("faultCodeId") ?? "") || null,
    type,
    responsibility,
    startedAt,
    endedAt,
    minutes,
    affectedOutput,
    note: String(formData.get("note") ?? "").trim() || null,
    createdById: user.id,
  };

  if (workOrderId) {
    const [existing] = await db
      .select({ id: downtimeRecords.id })
      .from(downtimeRecords)
      .where(eq(downtimeRecords.workOrderId, workOrderId))
      .limit(1);
    if (existing) {
      await db
        .update(downtimeRecords)
        .set(values)
        .where(eq(downtimeRecords.id, existing.id));
    } else {
      await db.insert(downtimeRecords).values(values);
    }
  } else {
    await db.insert(downtimeRecords).values(values);
  }

  await audit({
    entityType: "downtime",
    entityId: workOrderId ?? assetId,
    action: "downtime.create",
    detail: { assetId, workOrderId, type, minutes },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateReliability();
  revalidatePath(`/app/assets/${assetId}`);
  redirect("/app/faults?ok=1");
}

export async function deleteDowntimeRecord(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [row] = await db
    .select()
    .from(downtimeRecords)
    .where(eq(downtimeRecords.id, id))
    .limit(1);
  if (!row || row.workOrderId) return;

  await db.delete(downtimeRecords).where(eq(downtimeRecords.id, id));
  await audit({
    entityType: "downtime",
    entityId: id,
    action: "downtime.delete",
    detail: { assetId: row.assetId, minutes: row.minutes },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateReliability();
  revalidatePath(`/app/assets/${row.assetId}`);
  redirect("/app/faults?ok=2");
}
