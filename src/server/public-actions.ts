"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assets, inspectionTasks, inspectionTemplates, repairRequests, workOrderEvents, workOrders } from "@/db/schema";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { newToken } from "@/lib/qr";
import type { RepairDuplicate } from "@/lib/repair";
import { pickUploads, saveUploads } from "@/lib/uploads";
import { makeCode } from "@/lib/utils";
import { findOpenRepair } from "@/server/repair";

export type RepairFormState = {
  error?: string;
  duplicate?: RepairDuplicate;
  // 出错时回显已填内容，配合表单 key 重挂载避免被 React 表单重置清空
  values?: {
    description: string;
    reporterName: string;
    reporterPhone: string;
    priority: string;
  };
  attempt?: number;
};

export async function submitRepair(
  _prev: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  const assetToken = String(formData.get("assetToken") ?? "");
  const reporterName = String(formData.get("reporterName") ?? "").trim();
  const reporterPhone = String(formData.get("reporterPhone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "medium");
  const priority = ["low", "medium", "high", "urgent"].includes(priorityRaw)
    ? (priorityRaw as "low" | "medium" | "high" | "urgent")
    : "medium";
  const honeypot = String(formData.get("website") ?? "").trim();
  const values: NonNullable<RepairFormState["values"]> = {
    description,
    reporterName,
    reporterPhone,
    priority,
  };
  const fail = (error: string): RepairFormState => ({
    error,
    values,
    attempt: Date.now(),
  });

  if (honeypot) return fail("提交失败，请稍后重试");
  if (!assetToken) return fail("缺少设备信息，请重新扫码");
  if (!reporterName) return fail("请填写联系人");
  if (description.length < 5) return fail("请至少用 5 个字描述故障现象");

  // 直连部署时拿不到客户端 IP，此时不能把所有访客合并成同一个限流桶
  const ip = await getClientIp();
  if (ip !== "unknown") {
    const ipLimit = await rateLimit(`repair:ip:${ip}`, 5, 600);
    if (!ipLimit.allowed) {
      const minutes = Math.max(1, Math.ceil(ipLimit.retryAfterSeconds / 60));
      return fail(`提交过于频繁，请 ${minutes} 分钟后再试`);
    }
  }

  const [asset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.qrToken, assetToken))
    .limit(1);

  if (!asset) return fail("设备二维码无效或已停用");

  const assetLimit = await rateLimit(`repair:asset:${asset.id}`, 20, 3600);
  if (!assetLimit.allowed) {
    return fail("该设备的报修提交过于频繁，请稍后再试");
  }

  const duplicate = await findOpenRepair(asset.id);
  const confirmDuplicate =
    String(formData.get("confirmDuplicate") ?? "") === "1";
  if (duplicate && !confirmDuplicate) {
    return {
      duplicate,
      values,
      attempt: Date.now(),
    };
  }

  const publicToken = newToken(16);

  const [request] = await db
    .insert(repairRequests)
    .values({
      publicToken,
      assetId: asset.id,
      reporterName,
      reporterPhone: reporterPhone || null,
      description,
      priority,
    })
    .returning({ id: repairRequests.id });

  await saveUploads(pickUploads(formData), "repair_request", request.id);

  redirect(`/t/${publicToken}?new=1`);
}

export type InspectionFormState = {
  error?: string;
  values?: {
    executorName: string;
    note: string;
    items: string[];
  };
  attempt?: number;
};

export async function submitInspectionByToken(
  _prev: InspectionFormState,
  formData: FormData,
): Promise<InspectionFormState> {
  const assetToken = String(formData.get("assetToken") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const executorName = String(formData.get("executorName") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const honeypot = String(formData.get("website") ?? "").trim();

  const itemMap: Record<number, string> = {};
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("item_")) continue;
    const index = Number(key.slice("item_".length));
    if (Number.isInteger(index) && index >= 0) itemMap[index] = String(raw);
  }
  const maxIndex = Object.keys(itemMap).length
    ? Math.max(...Object.keys(itemMap).map(Number))
    : -1;
  const values: NonNullable<InspectionFormState["values"]> = {
    executorName,
    note,
    items: Array.from({ length: maxIndex + 1 }, (_, index) => itemMap[index] ?? ""),
  };
  const fail = (error: string): InspectionFormState => ({
    error,
    values,
    attempt: Date.now(),
  });

  if (honeypot) return fail("提交失败，请稍后重试");
  if (!assetToken || !taskId) return fail("缺少设备或点检任务信息，请重新扫码");
  if (!executorName) return fail("请填写执行人姓名");

  // 直连部署拿不到客户端 IP 时跳过 IP 维度，避免所有访客共用一个限流桶
  const ip = await getClientIp();
  if (ip !== "unknown") {
    const ipLimit = await rateLimit(`inspect:ip:${ip}`, 30, 600);
    if (!ipLimit.allowed) {
      const minutes = Math.max(1, Math.ceil(ipLimit.retryAfterSeconds / 60));
      return fail(`提交过于频繁，请 ${minutes} 分钟后再试`);
    }
  }

  const [asset] = await db
    .select({ id: assets.id, name: assets.name })
    .from(assets)
    .where(eq(assets.qrToken, assetToken))
    .limit(1);
  if (!asset) return fail("设备二维码无效或已停用");

  const [row] = await db
    .select({
      task: inspectionTasks,
      items: inspectionTemplates.items,
      templateName: inspectionTemplates.name,
    })
    .from(inspectionTasks)
    .innerJoin(
      inspectionTemplates,
      eq(inspectionTasks.templateId, inspectionTemplates.id),
    )
    .where(eq(inspectionTasks.id, taskId))
    .limit(1);

  if (!row || row.task.assetId !== asset.id) {
    return fail("点检任务无效，请重新扫码");
  }
  if (row.task.status !== "pending") {
    return fail("该点检任务已提交，无需重复填写");
  }

  const result: Record<string, string> = {};
  for (let index = 0; index < row.items.length; index += 1) {
    const item = row.items[index];
    const value = (itemMap[index] ?? "").trim();
    if (item.required && !value) {
      return fail(`请填写「${item.label}」`);
    }
    if (value) result[item.label] = value;
  }

  await db
    .update(inspectionTasks)
    .set({
      status: "done",
      completedAt: new Date(),
      result,
      note: note || null,
      executorName,
    })
    .where(eq(inspectionTasks.id, taskId));

  await saveUploads(pickUploads(formData), "inspection_task", taskId);

  const abnormal = Object.entries(result)
    .filter(([, value]) => value === "异常")
    .map(([label]) => label);

  if (abnormal.length) {
    const [wo] = await db
      .insert(workOrders)
      .values({
        code: makeCode("WO"),
        assetId: asset.id,
        title: `${asset.name} · ${row.templateName}点检异常`,
        description: `由扫码点检自动生成。异常项：${abnormal.join("、")}${
          note ? `。备注：${note}` : ""
        }`,
        status: "new",
        priority: "high",
      })
      .returning({ id: workOrders.id });

    await db.insert(workOrderEvents).values({
      workOrderId: wo.id,
      fromStatus: null,
      toStatus: "new",
      note: "扫码点检异常自动建单",
    });

    await db
      .update(inspectionTasks)
      .set({ workOrderId: wo.id })
      .where(eq(inspectionTasks.id, taskId));
  }

  revalidatePath("/app/inspection");
  revalidatePath(`/app/inspection/tasks/${taskId}`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/work-orders");

  redirect(`/d/${assetToken}?done=1`);
}
