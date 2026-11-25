import { and, asc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db";
import { pdmAlarms, pdmReadings, pdmRules, pdmSensors } from "@/db/schema";
import { evaluateRule, type PdmReadingShape } from "@/lib/pdm";

export type IngestReading = {
  value: number;
  recordedAt: Date;
  source?: string;
};

export function parseReadingValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 写入读数并评估该测点的启用规则。
 * 同规则同测点已有未关闭报警时累加次数，不重复建报警。
 */
export async function ingestSensorReadings(
  sensorId: string,
  readings: IngestReading[],
) {
  const [sensor] = await db
    .select()
    .from(pdmSensors)
    .where(eq(pdmSensors.id, sensorId))
    .limit(1);
  if (!sensor) return null;

  if (readings.length === 0) {
    return { sensor, created: 0, newAlarms: 0 };
  }

  await db.insert(pdmReadings).values(
    readings.map((reading) => ({
      sensorId,
      value: reading.value.toFixed(3),
      recordedAt: reading.recordedAt,
      source: reading.source ?? "manual",
    })),
  );

  const since = new Date(Date.now() - 24 * 60 * 60000);
  const [ruleRows, readingRows] = await Promise.all([
    db
      .select()
      .from(pdmRules)
      .where(and(eq(pdmRules.sensorId, sensorId), eq(pdmRules.active, true))),
    db
      .select({
        value: pdmReadings.value,
        recordedAt: pdmReadings.recordedAt,
      })
      .from(pdmReadings)
      .where(
        and(
          eq(pdmReadings.sensorId, sensorId),
          gte(pdmReadings.recordedAt, since),
        ),
      )
      .orderBy(asc(pdmReadings.recordedAt)),
  ]);

  const shapes: PdmReadingShape[] = readingRows.map((row) => ({
    value: Number(row.value),
    recordedAt: row.recordedAt,
  }));
  const now = new Date();
  let newAlarms = 0;

  for (const rule of ruleRows) {
    const result = evaluateRule(rule, shapes, now, sensor.unit);
    if (!result.hit) continue;

    const [existing] = await db
      .select({ id: pdmAlarms.id, occurrences: pdmAlarms.occurrences })
      .from(pdmAlarms)
      .where(
        and(
          eq(pdmAlarms.ruleId, rule.id),
          eq(pdmAlarms.sensorId, sensorId),
          inArray(pdmAlarms.status, ["open", "acknowledged", "converted"]),
        ),
      )
      .limit(1);

    const value = result.value === null ? null : result.value.toFixed(3);
    const threshold =
      result.threshold === null ? null : result.threshold.toFixed(3);

    if (existing) {
      await db
        .update(pdmAlarms)
        .set({
          severity: rule.severity,
          value,
          threshold,
          message: result.message,
          occurrences: existing.occurrences + 1,
          lastTriggeredAt: now,
        })
        .where(eq(pdmAlarms.id, existing.id));
    } else {
      await db.insert(pdmAlarms).values({
        ruleId: rule.id,
        sensorId,
        assetId: sensor.assetId,
        severity: rule.severity,
        status: "open",
        value,
        threshold,
        message: result.message,
        occurrences: 1,
        triggeredAt: now,
        lastTriggeredAt: now,
      });
      newAlarms += 1;
    }
  }

  return { sensor, created: readings.length, newAlarms };
}
