import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { pdmSensors } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireSecret } from "@/lib/env";
import { safeEqual } from "@/lib/secure";
import {
  ingestSensorReadings,
  parseReadingValue,
  type IngestReading,
} from "@/server/pdm-engine";

const MAX_BATCH = 500;

function readToken(request: NextRequest) {
  const header =
    request.headers.get("x-pdm-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return header.trim();
}

type IncomingReading = {
  value?: unknown;
  recordedAt?: unknown;
  timestamp?: unknown;
  source?: unknown;
};

/**
 * 测点读数推送：
 * POST /api/pdm/readings
 * Header: x-pdm-token: <PDM_INGEST_TOKEN>
 * Body: { "sensorCode": "PDMS-01", "readings": [{ "value": 8.2, "recordedAt": "2026-11-24T10:00:00+08:00" }] }
 * 也支持 sensorId、单条 value，或 body 直接为读数数组。
 */
export async function POST(request: NextRequest) {
  let expected: string;
  try {
    expected = requireSecret("PDM_INGEST_TOKEN", "dev-pdm-token");
  } catch {
    return NextResponse.json({ error: "服务未配置" }, { status: 503 });
  }
  if (!safeEqual(readToken(request), expected)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const payload = Array.isArray(body)
    ? ({ readings: body } as Record<string, unknown>)
    : (body as Record<string, unknown>);
  const sensorCode =
    typeof payload.sensorCode === "string"
      ? payload.sensorCode.trim().toUpperCase()
      : "";
  const sensorId =
    typeof payload.sensorId === "string" ? payload.sensorId.trim() : "";

  const rawReadings: IncomingReading[] = Array.isArray(payload.readings)
    ? (payload.readings as IncomingReading[])
    : payload.value !== undefined
      ? [{ value: payload.value, recordedAt: payload.recordedAt ?? payload.timestamp }]
      : [];

  if (rawReadings.length === 0) {
    return NextResponse.json(
      { error: "readings 不能为空，需提供 value" },
      { status: 400 },
    );
  }
  if (rawReadings.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `单次最多推送 ${MAX_BATCH} 条读数` },
      { status: 413 },
    );
  }

  const readings: IngestReading[] = [];
  for (const item of rawReadings) {
    const value = parseReadingValue(item?.value);
    if (value === null) {
      return NextResponse.json(
        { error: "读数 value 必须为数字" },
        { status: 400 },
      );
    }
    const recordedRaw =
      typeof item.recordedAt === "string"
        ? item.recordedAt
        : typeof item.timestamp === "string"
          ? item.timestamp
          : "";
    const recordedAt = recordedRaw ? new Date(recordedRaw) : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      return NextResponse.json(
        { error: `时间格式无效：${recordedRaw}` },
        { status: 400 },
      );
    }
    readings.push({
      value,
      recordedAt,
      source: typeof item.source === "string" ? item.source : "iot",
    });
  }

  let sensorIdResolved = sensorId;
  if (!sensorIdResolved && sensorCode) {
    const [sensor] = await db
      .select({ id: pdmSensors.id })
      .from(pdmSensors)
      .where(eq(pdmSensors.code, sensorCode))
      .limit(1);
    sensorIdResolved = sensor?.id ?? "";
  }

  if (!sensorIdResolved) {
    return NextResponse.json({ error: "未找到对应测点" }, { status: 404 });
  }

  const result = await ingestSensorReadings(sensorIdResolved, readings);
  if (!result) {
    return NextResponse.json({ error: "测点不存在" }, { status: 404 });
  }

  await audit({
    entityType: "pdm_reading",
    entityId: result.sensor.id,
    action: "pdm.reading.ingest",
    detail: {
      sensor: result.sensor.code,
      created: result.created,
      alarms: result.newAlarms,
      source: "api",
    },
    actorName: "IoT 网关",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({
    ok: true,
    sensor: {
      id: result.sensor.id,
      code: result.sensor.code,
      name: result.sensor.name,
    },
    created: result.created,
    alarms: result.newAlarms,
  });
}
