"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  assets,
  inspectionPoints,
  inspectionRunItems,
  inspectionRuns,
  inspectionRoutes,
  users,
  workOrderEvents,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { newToken } from "@/lib/qr";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { makeCode } from "@/lib/utils";
import { pickUploads, saveUploads } from "@/lib/uploads";

export type RouteFormState = { error?: string };

export async function createRoute(
  _prev: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const user = await requireUser();
  if (!canRepair(user.role)) return { error: "没有创建点检路线的权限" };

  const name = String(formData.get("name") ?? "").trim();
  const cycleRaw = Number(formData.get("cycleDays") ?? 7);
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  if (!name) return { error: "请填写路线名称" };

  const [route] = await db
    .insert(inspectionRoutes)
    .values({
      name,
      publicToken: newToken(),
      cycleDays: Number.isFinite(cycleRaw) && cycleRaw > 0 ? Math.round(cycleRaw) : 7,
      assigneeId,
    })
    .returning({ id: inspectionRoutes.id });

  await audit({
    entityType: "inspection_route",
    entityId: route.id,
    action: "route.create",
    detail: { name },
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath("/app/inspection/routes");
  redirect(`/app/inspection/routes/${route.id}`);
}

export async function addPoint(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const routeId = String(formData.get("routeId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!routeId || !assetId || !name) return;

  const checkType = String(formData.get("checkType") ?? "check");
  const minRaw = String(formData.get("standardMin") ?? "").trim();
  const maxRaw = String(formData.get("standardMax") ?? "").trim();
  const sortRaw = Number(formData.get("sort") ?? 0);

  const [last] = await db
    .select({ sort: inspectionPoints.sort })
    .from(inspectionPoints)
    .where(eq(inspectionPoints.routeId, routeId))
    .orderBy(desc(inspectionPoints.sort))
    .limit(1);

  await db.insert(inspectionPoints).values({
    routeId,
    assetId,
    name,
    checkType: checkType === "number" ? "number" : "check",
    standardMin: minRaw || null,
    standardMax: maxRaw || null,
    unit: String(formData.get("unit") ?? "").trim() || null,
    photoRequired: String(formData.get("photoRequired") ?? "") === "on",
    sort: Number.isFinite(sortRaw) && sortRaw > 0 ? Math.round(sortRaw) : (last?.sort ?? 0) + 10,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  revalidatePath(`/app/inspection/routes/${routeId}`);
  redirect(`/app/inspection/routes/${routeId}`);
}

export async function deletePoint(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;
  const id = String(formData.get("id") ?? "");
  const routeId = String(formData.get("routeId") ?? "");
  if (!id || !routeId) return;
  await db.delete(inspectionPoints).where(eq(inspectionPoints.id, id));
  revalidatePath(`/app/inspection/routes/${routeId}`);
  redirect(`/app/inspection/routes/${routeId}`);
}

export async function toggleRouteActive(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "1") === "1";
  if (!id) return;
  await db
    .update(inspectionRoutes)
    .set({ active })
    .where(eq(inspectionRoutes.id, id));
  await audit({
    entityType: "inspection_route",
    entityId: id,
    action: active ? "route.enable" : "route.disable",
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePath("/app/inspection/routes");
  revalidatePath(`/app/inspection/routes/${id}`);
}

/** 每条启用路线最多保留一个待执行 run；到期后自动生成。 */
export async function ensureDueRuns() {
  const now = new Date();
  const routes = await db
    .select()
    .from(inspectionRoutes)
    .where(eq(inspectionRoutes.active, true));

  for (const route of routes) {
    const [pending] = await db
      .select({ id: inspectionRuns.id })
      .from(inspectionRuns)
      .where(
        and(
          eq(inspectionRuns.routeId, route.id),
          inArray(inspectionRuns.status, ["pending", "in_progress"]),
        ),
      )
      .limit(1);
    if (pending) continue;

    const [last] = await db
      .select({ completedAt: inspectionRuns.completedAt, createdAt: inspectionRuns.createdAt })
      .from(inspectionRuns)
      .where(
        and(
          eq(inspectionRuns.routeId, route.id),
          eq(inspectionRuns.status, "done"),
        ),
      )
      .orderBy(desc(inspectionRuns.completedAt))
      .limit(1);

    const base = last?.completedAt ?? last?.createdAt ?? route.createdAt;
    const due = new Date(base);
    due.setDate(due.getDate() + Math.max(1, route.cycleDays));
    if (due.getTime() > now.getTime() && last) continue;

    await db.insert(inspectionRuns).values({
      routeId: route.id,
      dueAt: last ? due : now,
    });
  }
}

export type RouteRunState = { error?: string; attempt?: number };

function parseNumber(value: string) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** 公开扫码提交整条路线的点检结果；异常项自动生成工单。 */
export async function submitRouteRun(
  _prev: RouteRunState,
  formData: FormData,
): Promise<RouteRunState> {
  const token = String(formData.get("token") ?? "");
  const executorName = String(formData.get("executorName") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const honeypot = String(formData.get("website") ?? "").trim();
  const fail = (error: string): RouteRunState => ({ error, attempt: Date.now() });

  if (honeypot) return fail("提交失败，请稍后重试");
  if (!token) return fail("缺少路线信息，请重新扫码");
  if (!executorName) return fail("请填写点检人姓名");

  const ip = await getClientIp();
  if (ip !== "unknown") {
    const limit = await rateLimit(`route:ip:${ip}`, 20, 600);
    if (!limit.allowed) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
      return fail(`提交过于频繁，请 ${minutes} 分钟后再试`);
    }
  }

  const [route] = await db
    .select()
    .from(inspectionRoutes)
    .where(eq(inspectionRoutes.publicToken, token))
    .limit(1);
  if (!route || !route.active) return fail("路线二维码无效或已停用");

  const points = await db
    .select({
      id: inspectionPoints.id,
      name: inspectionPoints.name,
      assetId: inspectionPoints.assetId,
      checkType: inspectionPoints.checkType,
      standardMin: inspectionPoints.standardMin,
      standardMax: inspectionPoints.standardMax,
      unit: inspectionPoints.unit,
      photoRequired: inspectionPoints.photoRequired,
      sort: inspectionPoints.sort,
    })
    .from(inspectionPoints)
    .where(eq(inspectionPoints.routeId, route.id))
    .orderBy(asc(inspectionPoints.sort));

  if (!points.length) return fail("该路线还没有配置点位，请联系管理员");

  const photos = pickUploads(formData);
  if (points.some((point) => point.photoRequired) && photos.length === 0) {
    return fail("该路线有点位要求拍照，请至少上传一张现场照片");
  }

  const values: Record<string, { value: string; status: "ok" | "abnormal"; note: string }> = {};
  for (const point of points) {
    const rawValue = String(formData.get(`item_${point.id}_value`) ?? "").trim();
    const status = String(formData.get(`item_${point.id}_status`) ?? "ok");
    const itemNote = String(formData.get(`item_${point.id}_note`) ?? "").trim();
    const abnormal = status === "abnormal";
    const value = rawValue || (abnormal ? "异常" : "正常");
    if (!value) return fail(`请填写「${point.name}」的检查结果`);
    if (point.checkType === "number" && parseNumber(value) === null) {
      return fail(`「${point.name}」需要填写数值`);
    }
    values[point.id] = {
      value,
      status: abnormal ? "abnormal" : "ok",
      note: itemNote,
    };
  }

  const now = new Date();
  const [run] = await db
    .select({ id: inspectionRuns.id })
    .from(inspectionRuns)
    .where(
      and(
        eq(inspectionRuns.routeId, route.id),
        inArray(inspectionRuns.status, ["pending", "in_progress"]),
      ),
    )
    .orderBy(asc(inspectionRuns.dueAt))
    .limit(1);

  const runId =
    run?.id ??
    (
      await db
        .insert(inspectionRuns)
        .values({
          routeId: route.id,
          status: "in_progress",
          dueAt: now,
          executorName,
          startedAt: now,
        })
        .returning({ id: inspectionRuns.id })
    )[0].id;

  await db
    .update(inspectionRuns)
    .set({
      status: "done",
      executorName,
      startedAt: now,
      completedAt: now,
      note: note || null,
    })
    .where(eq(inspectionRuns.id, runId));

  const assetRows = await db
    .select({ id: assets.id, name: assets.name })
    .from(assets)
    .where(
      inArray(
        assets.id,
        points.map((point) => point.assetId),
      ),
    );
  const assetName = new Map(assetRows.map((row) => [row.id, row.name]));

  for (const point of points) {
    const item = values[point.id];
    const abnormal = item.status === "abnormal";
    let workOrderId: string | null = null;

    if (abnormal) {
      const outOfRange =
        point.checkType === "number" &&
        parseNumber(item.value) !== null &&
        ((point.standardMin !== null &&
          Number(item.value) < Number(point.standardMin)) ||
          (point.standardMax !== null &&
            Number(item.value) > Number(point.standardMax)));

      const [wo] = await db
        .insert(workOrders)
        .values({
          code: makeCode("WO"),
          assetId: point.assetId,
          type: "inspection",
          title: `${assetName.get(point.assetId) ?? "设备"} · ${point.name}点检异常`,
          description: [
            `由点检路线「${route.name}」扫码自动生成。`,
            `点位：${point.name}`,
            `实测：${item.value}${point.unit ?? ""}`,
            outOfRange ? "判定：超出标准上下限" : null,
            item.note ? `异常说明：${item.note}` : null,
            note ? `路线备注：${note}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          status: route.assigneeId ? "assigned" : "new",
          priority: "high",
          assigneeId: route.assigneeId,
          routeId: route.id,
          pointId: point.id,
          faultPhenomenon: `${point.name}：${item.value}${point.unit ?? ""}`,
        })
        .returning({ id: workOrders.id });

      await db.insert(workOrderEvents).values({
        workOrderId: wo.id,
        fromStatus: null,
        toStatus: route.assigneeId ? "assigned" : "new",
        note: "点检异常自动建单",
      });
      await audit({
        entityType: "work_order",
        entityId: wo.id,
        action: "work_order.from_inspection",
        detail: { routeId: route.id, pointId: point.id, value: item.value },
        actorName: executorName,
      });
      await notify(
        route.assigneeId,
        `点检异常：${assetName.get(point.assetId) ?? "设备"}`,
        `${point.name}：${item.value}${point.unit ?? ""}`,
        `/app/work-orders/${wo.id}`,
      );
      workOrderId = wo.id;
    }

    await db.insert(inspectionRunItems).values({
      runId,
      pointId: point.id,
      value: item.value,
      status: abnormal ? "abnormal" : "ok",
      note: item.note || null,
      workOrderId,
    });
  }

  if (photos.length) {
    await saveUploads(photos, "inspection_run", runId);
  }

  revalidatePath("/app/inspection/routes");
  revalidatePath("/app/inspection");
  revalidatePath("/app/work-orders");
  revalidatePath("/app/dashboard");
  redirect(`/i/${token}?done=1`);
}

/** 后台手工补检：为某条路线创建一条待执行 run。 */
export async function createManualRun(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;
  const routeId = String(formData.get("routeId") ?? "");
  if (!routeId) return;
  const now = new Date();
  await db.insert(inspectionRuns).values({
    routeId,
    dueAt: now,
    executorName: user.name,
  });
  revalidatePath("/app/inspection/routes");
  revalidatePath(`/app/inspection/routes/${routeId}`);
  redirect(`/app/inspection/routes/${routeId}`);
}

export async function routeAssigneeList() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true));
}
