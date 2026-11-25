import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  downtimeRecords,
  faultCodes,
  workOrders,
} from "@/db/schema";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * 故障与停机分析的统一取数口径。
 * 页面与 AI 分析共用同一份结果，避免两处各算一套指标导致结论对不上。
 */
export async function loadFaultsAnalytics(days: number) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);

  const [recordRows, assetRows, codeRows, woRows, machineRows] =
    await Promise.all([
      db
        .select({
          record: downtimeRecords,
          assetName: assets.name,
          assetCode: assets.code,
          faultCode: faultCodes.code,
          faultName: faultCodes.name,
          workOrderCode: workOrders.code,
        })
        .from(downtimeRecords)
        .innerJoin(assets, eq(downtimeRecords.assetId, assets.id))
        .leftJoin(faultCodes, eq(downtimeRecords.faultCodeId, faultCodes.id))
        .leftJoin(workOrders, eq(downtimeRecords.workOrderId, workOrders.id))
        .where(gte(downtimeRecords.startedAt, since))
        .orderBy(desc(downtimeRecords.startedAt)),
      db
        .select({ id: assets.id, code: assets.code, name: assets.name })
        .from(assets)
        .where(inArray(assets.level, ["machine", "component"]))
        .orderBy(asc(assets.code)),
      db
        .select()
        .from(faultCodes)
        .where(eq(faultCodes.active, true))
        .orderBy(asc(faultCodes.code)),
      db
        .select({
          id: workOrders.id,
          code: workOrders.code,
          title: workOrders.title,
          assetName: assets.name,
        })
        .from(workOrders)
        .innerJoin(assets, eq(workOrders.assetId, assets.id))
        .where(gte(workOrders.createdAt, since))
        .orderBy(desc(workOrders.createdAt))
        .limit(50),
      db
        .select({ n: count() })
        .from(assets)
        .where(
          and(
            inArray(assets.level, ["machine", "component"]),
            ne(assets.status, "retired"),
          ),
        ),
    ]);

  const unplanned = recordRows.filter((row) => row.record.type === "unplanned");
  const faultCount = unplanned.length;
  const totalMinutes = recordRows.reduce(
    (sum, row) => sum + row.record.minutes,
    0,
  );
  const unplannedMinutes = unplanned.reduce(
    (sum, row) => sum + row.record.minutes,
    0,
  );
  const affectedTotal = recordRows.reduce(
    (sum, row) => sum + (row.record.affectedOutput ?? 0),
    0,
  );
  const mttr = faultCount ? Math.round(unplannedMinutes / faultCount) : null;
  const machineCount = Math.max(1, Number(machineRows[0]?.n ?? 1));
  const availableMinutes = days * 24 * 60 * machineCount;
  const mtbfHours =
    faultCount > 0
      ? Math.max(0, (availableMinutes - totalMinutes) / faultCount / 60)
      : null;

  const codeStats = new Map<
    string,
    { code: string; name: string; count: number; minutes: number }
  >();
  for (const row of unplanned) {
    const key = row.record.faultCodeId ?? "none";
    const entry = codeStats.get(key) ?? {
      code: row.faultCode ?? "—",
      name: row.faultName ?? "未分类",
      count: 0,
      minutes: 0,
    };
    entry.count += 1;
    entry.minutes += row.record.minutes;
    codeStats.set(key, entry);
  }
  const topCodes = [...codeStats.values()]
    .sort((a, b) => b.count - a.count || b.minutes - a.minutes)
    .slice(0, 6);
  const maxCodeCount = topCodes[0]?.count ?? 1;

  const assetStats = new Map<
    string,
    { name: string; code: string; count: number; minutes: number }
  >();
  for (const row of unplanned) {
    const entry = assetStats.get(row.record.assetId) ?? {
      name: row.assetName,
      code: row.assetCode,
      count: 0,
      minutes: 0,
    };
    entry.count += 1;
    entry.minutes += row.record.minutes;
    assetStats.set(row.record.assetId, entry);
  }
  const topAssets = [...assetStats.values()]
    .sort((a, b) => b.minutes - a.minutes || b.count - a.count)
    .slice(0, 6);
  const maxAssetMinutes = topAssets[0]?.minutes ?? 1;

  const responsibilityStats = new Map<
    string,
    { count: number; minutes: number }
  >();
  for (const row of unplanned) {
    const entry = responsibilityStats.get(row.record.responsibility) ?? {
      count: 0,
      minutes: 0,
    };
    entry.count += 1;
    entry.minutes += row.record.minutes;
    responsibilityStats.set(row.record.responsibility, entry);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (13 - index));
    return {
      date,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      minutes: 0,
      count: 0,
    };
  });
  for (const row of recordRows) {
    const date = new Date(row.record.startedAt);
    date.setHours(0, 0, 0, 0);
    const bucket = trend.find((item) => item.date.getTime() === date.getTime());
    if (bucket) {
      bucket.minutes += row.record.minutes;
      if (row.record.type === "unplanned") bucket.count += 1;
    }
  }
  const maxTrend = Math.max(...trend.map((item) => item.minutes), 1);

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        days,
        faultCount,
        totalMinutes,
        unplannedMinutes,
        affectedTotal,
        mttr,
        mtbfHours === null ? null : Math.round(mtbfHours),
        machineCount,
        topCodes.map((item) => [item.code, item.count, item.minutes]),
        topAssets.map((item) => [item.code, item.count, item.minutes]),
        [...responsibilityStats.entries()].sort(),
        trend.map((item) => [item.label, item.minutes, item.count]),
      ]),
    )
    .digest("hex")
    .slice(0, 32);

  return {
    days,
    now,
    since,
    recordRows,
    assetRows,
    codeRows,
    woRows,
    machineCount,
    faultCount,
    totalMinutes,
    unplannedMinutes,
    affectedTotal,
    mttr,
    mtbfHours,
    topCodes,
    topAssets,
    maxCodeCount,
    maxAssetMinutes,
    responsibilityStats,
    trend,
    maxTrend,
    fingerprint,
  };
}

export type FaultsAnalytics = Awaited<ReturnType<typeof loadFaultsAnalytics>>;

/** 页面表单需要的时间输入格式。 */
export function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
