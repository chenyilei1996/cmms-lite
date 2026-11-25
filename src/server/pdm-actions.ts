"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  assets,
  pdmAlarms,
  pdmRules,
  pdmSensors,
  pdmSuggestedWorkOrders,
  workOrderEvents,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { PDM_SEVERITY } from "@/lib/pdm";
import { makeCode } from "@/lib/utils";
import { ingestSensorReadings, parseReadingValue } from "./pdm-engine";

const METRICS = ["vibration", "temperature", "current", "oil", "other"] as const;
const MODES = ["threshold", "duration", "slope", "combined"] as const;
const DIRECTIONS = ["above", "below"] as const;
const SEVERITIES = ["info", "warning", "critical"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function revalidatePdm() {
  revalidatePath("/app/pdm");
  revalidatePath("/admin/pdm/sensors");
  revalidatePath("/app/pdm/alarms");
  revalidatePath("/app/pdm/suggestions");
}

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function precision(value: number | null) {
  return value === null ? null : value.toFixed(3);
}

export async function createSensor(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const assetId = String(formData.get("assetId") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const metricRaw = String(formData.get("metric") ?? "other");
  const metric = (METRICS as readonly string[]).includes(metricRaw)
    ? (metricRaw as (typeof METRICS)[number])
    : "other";
  if (!assetId || !code || !name) redirect("/admin/pdm/sensors?error=sensor");

  const [duplicate] = await db
    .select({ id: pdmSensors.id })
    .from(pdmSensors)
    .where(eq(pdmSensors.code, code))
    .limit(1);
  if (duplicate) redirect("/admin/pdm/sensors?error=duplicate");

  const [created] = await db
    .insert(pdmSensors)
    .values({
      assetId,
      code,
      name,
      metric,
      unit: String(formData.get("unit") ?? "").trim(),
      installLocation:
        String(formData.get("installLocation") ?? "").trim() || null,
    })
    .returning({ id: pdmSensors.id, code: pdmSensors.code });

  await audit({
    entityType: "pdm_sensor",
    entityId: created.id,
    action: "pdm.sensor.create",
    detail: { code: created.code, assetId },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect(`/admin/pdm/sensors?ok=sensor#sensor-${created.id}`);
}

export async function updateSensor(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [sensor] = await db
    .select()
    .from(pdmSensors)
    .where(eq(pdmSensors.id, id))
    .limit(1);
  if (!sensor) return;

  const metricRaw = String(formData.get("metric") ?? sensor.metric);
  const metric = (METRICS as readonly string[]).includes(metricRaw)
    ? (metricRaw as (typeof METRICS)[number])
    : sensor.metric;

  await db
    .update(pdmSensors)
    .set({
      name: String(formData.get("name") ?? sensor.name).trim() || sensor.name,
      metric,
      unit: String(formData.get("unit") ?? sensor.unit).trim(),
      installLocation:
        String(formData.get("installLocation") ?? "").trim() || null,
      active: formData.get("active") === "on",
    })
    .where(eq(pdmSensors.id, id));

  await audit({
    entityType: "pdm_sensor",
    entityId: id,
    action: "pdm.sensor.update",
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect(`/admin/pdm/sensors?ok=sensor#sensor-${id}`);
}

export async function createRule(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const sensorId = String(formData.get("sensorId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const modeRaw = String(formData.get("mode") ?? "threshold");
  const mode = (MODES as readonly string[]).includes(modeRaw)
    ? (modeRaw as (typeof MODES)[number])
    : "threshold";
  const directionRaw = String(formData.get("direction") ?? "above");
  const direction = (DIRECTIONS as readonly string[]).includes(directionRaw)
    ? (directionRaw as (typeof DIRECTIONS)[number])
    : "above";
  const severityRaw = String(formData.get("severity") ?? "warning");
  const severity = (SEVERITIES as readonly string[]).includes(severityRaw)
    ? (severityRaw as (typeof SEVERITIES)[number])
    : "warning";

  const threshold = numberOrNull(formData.get("threshold"));
  const duration = numberOrNull(formData.get("durationMinutes"));
  const slope = numberOrNull(formData.get("slopePerDay"));

  if (!sensorId || !name) redirect("/admin/pdm/sensors?error=rule");
  if ((mode === "threshold" || mode === "duration" || mode === "combined") && threshold === null) {
    redirect("/admin/pdm/sensors?error=rule");
  }
  if (mode === "duration" && duration === null) {
    redirect("/admin/pdm/sensors?error=rule");
  }
  if (mode === "slope" && slope === null) {
    redirect("/admin/pdm/sensors?error=rule");
  }

  const [sensor] = await db
    .select({ id: pdmSensors.id })
    .from(pdmSensors)
    .where(eq(pdmSensors.id, sensorId))
    .limit(1);
  if (!sensor) redirect("/admin/pdm/sensors?error=rule");

  const [created] = await db
    .insert(pdmRules)
    .values({
      sensorId,
      name,
      mode,
      direction,
      threshold: precision(threshold),
      durationMinutes:
        duration === null ? null : Math.max(1, Math.round(duration)),
      slopePerDay: precision(slope),
      severity,
      note: String(formData.get("note") ?? "").trim() || null,
    })
    .returning({ id: pdmRules.id });

  await audit({
    entityType: "pdm_rule",
    entityId: created.id,
    action: "pdm.rule.create",
    detail: { sensorId, mode, severity, threshold, duration, slope },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect(`/admin/pdm/sensors?ok=rule#sensor-${sensorId}`);
}

export async function toggleRule(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [rule] = await db
    .select()
    .from(pdmRules)
    .where(eq(pdmRules.id, id))
    .limit(1);
  if (!rule) return;

  const active = formData.get("active") === "1";
  await db
    .update(pdmRules)
    .set({ active, updatedAt: new Date() })
    .where(eq(pdmRules.id, id));

  await audit({
    entityType: "pdm_rule",
    entityId: id,
    action: active ? "pdm.rule.enable" : "pdm.rule.disable",
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect(`/admin/pdm/sensors?ok=rule#sensor-${rule.sensorId}`);
}

export async function addReading(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const sensorId = String(formData.get("sensorId") ?? "");
  const value = parseReadingValue(formData.get("value"));
  const recordedRaw = String(formData.get("recordedAt") ?? "");
  if (!sensorId || value === null) redirect("/admin/pdm/sensors?error=reading");

  const recordedAt = recordedRaw ? new Date(recordedRaw) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    redirect("/admin/pdm/sensors?error=reading");
  }

  const result = await ingestSensorReadings(sensorId, [
    { value, recordedAt, source: "manual" },
  ]);
  if (!result) redirect("/admin/pdm/sensors?error=reading");

  await audit({
    entityType: "pdm_reading",
    entityId: sensorId,
    action: "pdm.reading.manual",
    detail: { value, recordedAt: recordedAt.toISOString(), alarms: result.newAlarms },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect(`/admin/pdm/sensors?ok=reading&alarms=${result.newAlarms}#sensor-${sensorId}`);
}

export async function acknowledgeAlarm(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [alarm] = await db
    .select()
    .from(pdmAlarms)
    .where(eq(pdmAlarms.id, id))
    .limit(1);
  if (!alarm || alarm.status !== "open") return;

  await db
    .update(pdmAlarms)
    .set({
      status: "acknowledged",
      acknowledgedById: user.id,
      acknowledgedAt: new Date(),
    })
    .where(eq(pdmAlarms.id, id));

  await audit({
    entityType: "pdm_alarm",
    entityId: id,
    action: "pdm.alarm.acknowledge",
    detail: { severity: alarm.severity },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect("/app/pdm/alarms?ok=ack");
}

export async function dismissAlarm(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [alarm] = await db
    .select()
    .from(pdmAlarms)
    .where(eq(pdmAlarms.id, id))
    .limit(1);
  if (!alarm) return;

  await db
    .update(pdmAlarms)
    .set({
      status: "dismissed",
      acknowledgedById: user.id,
      acknowledgedAt: new Date(),
    })
    .where(eq(pdmAlarms.id, id));

  await audit({
    entityType: "pdm_alarm",
    entityId: id,
    action: "pdm.alarm.dismiss",
    detail: { severity: alarm.severity },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect("/app/pdm/alarms?ok=dismiss");
}

export async function createSuggestion(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const alarmId = String(formData.get("alarmId") ?? "");
  if (!alarmId) return;

  const [row] = await db
    .select({
      alarm: pdmAlarms,
      sensor: pdmSensors,
      asset: assets,
      rule: pdmRules,
    })
    .from(pdmAlarms)
    .innerJoin(pdmSensors, eq(pdmAlarms.sensorId, pdmSensors.id))
    .innerJoin(assets, eq(pdmAlarms.assetId, assets.id))
    .innerJoin(pdmRules, eq(pdmAlarms.ruleId, pdmRules.id))
    .where(eq(pdmAlarms.id, alarmId))
    .limit(1);
  if (!row) return;

  const [existing] = await db
    .select({ id: pdmSuggestedWorkOrders.id })
    .from(pdmSuggestedWorkOrders)
    .where(
      and(
        eq(pdmSuggestedWorkOrders.alarmId, alarmId),
        eq(pdmSuggestedWorkOrders.status, "pending"),
      ),
    )
    .limit(1);
  if (existing) redirect("/app/pdm/suggestions?error=exists");

  const severity = PDM_SEVERITY[row.alarm.severity] ?? PDM_SEVERITY.warning;
  const priority =
    row.alarm.severity === "critical"
      ? "high"
      : row.alarm.severity === "warning"
        ? "medium"
        : "low";
  const title = `[预测] ${row.asset.name} · ${row.sensor.name} ${severity.label}报警`;
  const description = [
    `测点：${row.sensor.code} ${row.sensor.name}${row.sensor.unit ? `（${row.sensor.unit}）` : ""}`,
    `规则：${row.rule.name}`,
    `报警：${row.alarm.message ?? "—"}`,
    `触发时间：${row.alarm.triggeredAt.toLocaleString("zh-CN")}，累计 ${row.alarm.occurrences} 次`,
    "来源：预测性维护建议（需人工确认后执行，不自动停机）",
  ].join("\n");

  const [created] = await db
    .insert(pdmSuggestedWorkOrders)
    .values({
      code: makeCode("PSW"),
      assetId: row.asset.id,
      alarmId,
      title,
      description,
      priority,
      status: "pending",
      createdById: user.id,
    })
    .returning({ id: pdmSuggestedWorkOrders.id, code: pdmSuggestedWorkOrders.code });

  await db
    .update(pdmAlarms)
    .set({ status: "converted" })
    .where(eq(pdmAlarms.id, alarmId));

  await audit({
    entityType: "pdm_suggestion",
    entityId: created.id,
    action: "pdm.suggestion.create",
    detail: { alarmId, code: created.code, priority },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect("/app/pdm/suggestions?ok=created");
}

export async function convertSuggestion(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [suggestion] = await db
    .select()
    .from(pdmSuggestedWorkOrders)
    .where(eq(pdmSuggestedWorkOrders.id, id))
    .limit(1);
  if (!suggestion || suggestion.status !== "pending") return;

  const priorityRaw = String(formData.get("priority") ?? suggestion.priority);
  const priority = (PRIORITIES as readonly string[]).includes(priorityRaw)
    ? (priorityRaw as (typeof PRIORITIES)[number])
    : suggestion.priority;
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const dueRaw = String(formData.get("dueAt") ?? "");
  let dueAt: Date | null = null;
  if (dueRaw) {
    dueAt = new Date(`${dueRaw}T18:00:00`);
    if (Number.isNaN(dueAt.getTime())) dueAt = null;
  }

  const now = new Date();
  const [created] = await db
    .insert(workOrders)
    .values({
      code: makeCode("WO"),
      assetId: suggestion.assetId,
      type: "corrective",
      title: suggestion.title,
      description: suggestion.description,
      status: assigneeId ? "assigned" : "new",
      priority,
      assigneeId,
      dueAt,
    })
    .returning({ id: workOrders.id, code: workOrders.code });

  await db.insert(workOrderEvents).values({
    workOrderId: created.id,
    fromStatus: null,
    toStatus: assigneeId ? "assigned" : "new",
    note: `由预测性维护建议 ${suggestion.code} 转单`,
    actorId: user.id,
  });

  const note = String(formData.get("note") ?? "").trim() || null;
  await db
    .update(pdmSuggestedWorkOrders)
    .set({
      status: "converted",
      convertedWorkOrderId: created.id,
      handledAt: now,
      note,
    })
    .where(eq(pdmSuggestedWorkOrders.id, id));

  if (assigneeId) {
    await notify(
      assigneeId,
      `预测性维护工单：${suggestion.title}`,
      `由建议 ${suggestion.code} 转为纠正性维修工单，请确认现场状态后执行。`,
      `/app/work-orders/${created.id}`,
    );
  }

  await audit({
    entityType: "pdm_suggestion",
    entityId: id,
    action: "pdm.suggestion.convert",
    detail: { workOrderId: created.id, workOrderCode: created.code, priority },
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  revalidatePath("/app/work-orders");
  redirect(`/app/work-orders/${created.id}`);
}

export async function dismissSuggestion(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [suggestion] = await db
    .select()
    .from(pdmSuggestedWorkOrders)
    .where(eq(pdmSuggestedWorkOrders.id, id))
    .limit(1);
  if (!suggestion || suggestion.status !== "pending") return;

  await db
    .update(pdmSuggestedWorkOrders)
    .set({
      status: "dismissed",
      handledAt: new Date(),
      note: String(formData.get("note") ?? "").trim() || "人工驳回",
    })
    .where(eq(pdmSuggestedWorkOrders.id, id));

  if (suggestion.alarmId) {
    await db
      .update(pdmAlarms)
      .set({ status: "dismissed", acknowledgedById: user.id, acknowledgedAt: new Date() })
      .where(
        and(
          eq(pdmAlarms.id, suggestion.alarmId),
          inArray(pdmAlarms.status, ["open", "acknowledged", "converted"]),
        ),
      );
  }

  await audit({
    entityType: "pdm_suggestion",
    entityId: id,
    action: "pdm.suggestion.dismiss",
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePdm();
  redirect("/app/pdm/suggestions?ok=dismiss");
}
