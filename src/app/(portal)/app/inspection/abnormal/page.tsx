import { ArrowLeft, ArrowRight, ClipboardText, Cube, Gauge, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  inspectionPoints,
  inspectionRoutes,
  inspectionRunItems,
  inspectionRuns,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";

export const metadata = { title: "点检异常记录" };

const RANGES = [
  { days: 7, label: "近 7 天" },
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
] as const;

function formatValue(
  value: string | null,
  unit: string | null,
  checkType: string,
) {
  if (!value) return "—";
  if (checkType === "number") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return `${numeric.toFixed(Math.abs(numeric) >= 100 ? 0 : 1)}${unit ? ` ${unit}` : ""}`;
    }
  }
  return unit ? `${value} ${unit}` : value;
}

function formatStandard(
  min: string | null,
  max: string | null,
  unit: string | null,
) {
  if (!min && !max) return "未设标准范围";
  const suffix = unit ? ` ${unit}` : "";
  if (min && max) return `${Number(min)}–${Number(max)}${suffix}`;
  if (min) return `≥ ${Number(min)}${suffix}`;
  return `≤ ${Number(max)}${suffix}`;
}

type PointGroup = {
  pointId: string;
  pointName: string;
  unit: string | null;
  checkType: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  routeId: string;
  routeName: string;
  count: number;
  lastValue: string | null;
  lastAt: Date;
  workOrderCount: number;
};

export default async function InspectionAbnormalPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; asset?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();

  const range = RANGES.some((item) => String(item.days) === sp.range)
    ? Number(sp.range)
    : 30;
  const now = new Date();
  const since = new Date(now.getTime() - range * 86400000);
  const assetFilter = /^[0-9a-f-]{36}$/i.test(sp.asset ?? "")
    ? sp.asset
    : undefined;

  const rows = await db
    .select({
      itemId: inspectionRunItems.id,
      value: inspectionRunItems.value,
      note: inspectionRunItems.note,
      createdAt: inspectionRunItems.createdAt,
      workOrderId: inspectionRunItems.workOrderId,
      pointId: inspectionPoints.id,
      pointName: inspectionPoints.name,
      checkType: inspectionPoints.checkType,
      unit: inspectionPoints.unit,
      standardMin: inspectionPoints.standardMin,
      standardMax: inspectionPoints.standardMax,
      assetId: assets.id,
      assetName: assets.name,
      assetCode: assets.code,
      routeId: inspectionRoutes.id,
      routeName: inspectionRoutes.name,
      executorName: inspectionRuns.executorName,
    })
    .from(inspectionRunItems)
    .innerJoin(
      inspectionPoints,
      eq(inspectionRunItems.pointId, inspectionPoints.id),
    )
    .innerJoin(assets, eq(inspectionPoints.assetId, assets.id))
    .innerJoin(inspectionRuns, eq(inspectionRunItems.runId, inspectionRuns.id))
    .innerJoin(inspectionRoutes, eq(inspectionRuns.routeId, inspectionRoutes.id))
    .where(
      and(
        eq(inspectionRunItems.status, "abnormal"),
        gte(inspectionRunItems.createdAt, since),
        assetFilter ? eq(assets.id, assetFilter) : undefined,
      ),
    )
    .orderBy(desc(inspectionRunItems.createdAt));

  const pointMap = new Map<string, PointGroup>();
  for (const row of rows) {
    const existing = pointMap.get(row.pointId);
    if (!existing) {
      pointMap.set(row.pointId, {
        pointId: row.pointId,
        pointName: row.pointName,
        unit: row.unit,
        checkType: row.checkType,
        assetId: row.assetId,
        assetName: row.assetName,
        assetCode: row.assetCode,
        routeId: row.routeId,
        routeName: row.routeName,
        count: 1,
        lastValue: row.value,
        lastAt: row.createdAt,
        workOrderCount: row.workOrderId ? 1 : 0,
      });
      continue;
    }
    existing.count += 1;
    if (row.workOrderId) existing.workOrderCount += 1;
  }

  const repeated = Array.from(pointMap.values())
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count);
  const assetCount = new Set(rows.map((row) => row.assetId)).size;
  const convertedCount = rows.filter((row) => row.workOrderId).length;

  return (
    <>
      <PageHeader
        eyebrow="Inspection · abnormal log"
        title="点检异常记录"
        description="按测点汇总点检判定的异常项，重复出现的测点会排在最前面，便于判断是偶发还是设备劣化。"
        actions={
          <>
            <LinkButton href="/app/inspection" variant="secondary">
              <ArrowLeft className="size-4" /> 返回点检
            </LinkButton>
            <LinkButton href="/app/work-orders">
              <ClipboardText className="size-4" /> 维修工单
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((item) => {
          const active = item.days === range;
          return (
            <Link
              key={item.days}
              href={`/app/inspection/abnormal?range=${item.days}`}
              className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${
                active
                  ? "bg-ink text-white"
                  : "border border-line bg-surface text-ink-soft hover:border-ink/25"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        {assetFilter && (
          <Link
            href={`/app/inspection/abnormal?range=${range}`}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-muted hover:border-ink/25"
          >
            只看 {rows[0]?.assetName ?? "当前设备"} ×
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="异常项"
          value={rows.length}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub={`近 ${range} 天累计`}
        />
        <StatCard
          label="涉及测点"
          value={pointMap.size}
          tone="honey"
          icon={<Gauge className="size-4" />}
          sub={`${assetCount} 台设备`}
        />
        <StatCard
          label="反复异常测点"
          value={repeated.length}
          tone="accent"
          icon={<Warning className="size-4" />}
          sub="同一点位 ≥ 2 次"
        />
        <StatCard
          label="已转工单"
          value={convertedCount}
          tone="mint"
          icon={<ClipboardText className="size-4" />}
          sub="异常已进入维修流程"
        />
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">反复异常测点</h2>
          <span className="label-mono">REPEATED {repeated.length}</span>
        </div>
        {repeated.length === 0 ? (
          <EmptyState
            icon={<Gauge className="size-7" />}
            title="没有重复异常测点"
            hint="同一测点在统计周期内出现 2 次及以上异常时会显示在这里。"
          />
        ) : (
          <ul className="divide-y divide-line">
            {repeated.map((item) => (
              <li key={item.pointId}>
                <Link
                  href={`/app/inspection/routes/${item.routeId}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                >
                  <Badge tone="danger">{item.count} 次</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      {item.assetName} · {item.pointName}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">
                      {item.assetCode} · {item.routeName}
                      {item.workOrderCount > 0
                        ? ` · 已转工单 ${item.workOrderCount} 次`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-ink-soft">
                      最近 {formatValue(item.lastValue, item.unit, item.checkType)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {fmtDateTime(item.lastAt)}
                    </p>
                  </div>
                  <ArrowRight className="size-3.5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">异常明细</h2>
          <span className="label-mono">LATEST {Math.min(rows.length, 50)}</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Cube className="size-7" />}
            title="该周期内没有点检异常"
            hint="点检时判定为异常的项会自动记录在这里，并推送站内提醒。"
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.slice(0, 50).map((row) => (
              <li key={row.itemId} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger" dot>
                    异常
                  </Badge>
                  <span className="text-[12px] font-medium">
                    {row.assetName} · {row.pointName}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {row.assetCode}
                  </span>
                  <span className="ml-auto text-[10px] text-muted">
                    {fmtDateTime(row.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-soft">
                  实测{" "}
                  <span className="font-mono">
                    {formatValue(row.value, row.unit, row.checkType)}
                  </span>
                  <span className="text-muted">
                    {" "}
                    · 标准{" "}
                    {formatStandard(row.standardMin, row.standardMax, row.unit)}
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {row.routeName}
                  {row.executorName ? ` · 执行人 ${row.executorName}` : ""}
                </p>
                {row.note && (
                  <p className="mt-1 text-[11px] text-muted">备注：{row.note}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-3 text-[10px]">
                  <Link
                    href={`/app/inspection/abnormal?range=${range}&asset=${row.assetId}`}
                    className="text-muted hover:text-ink"
                  >
                    只看该设备 →
                  </Link>
                  <Link
                    href={`/app/inspection/routes/${row.routeId}`}
                    className="text-muted hover:text-ink"
                  >
                    查看点检路线 →
                  </Link>
                  {row.workOrderId && (
                    <Link
                      href={`/app/work-orders/${row.workOrderId}`}
                      className="text-accent-ink hover:underline"
                    >
                      查看关联工单 →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
