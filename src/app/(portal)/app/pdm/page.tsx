import { ArrowRight, Bell, ClipboardText, Gauge, Pulse, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, desc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  pdmAlarms,
  pdmReadings,
  pdmRules,
  pdmSensors,
  pdmSuggestedWorkOrders,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import {
  PDM_ALARM_STATUS,
  PDM_METRIC,
  PDM_SEVERITY,
  PDM_SUGGESTION_STATUS,
} from "@/lib/pdm";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { Sparkline } from "@/components/sparkline";

export const metadata = { title: "预测性维护" };

const SEVERITY_ORDER: Record<string, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

const RANGES = [1, 7, 30] as const;

function bucketKey(date: Date, mode: "hour" | "day") {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return mode === "hour"
    ? `${y}-${m}-${d} ${String(date.getHours()).padStart(2, "0")}`
    : `${y}-${m}-${d}`;
}

function formatValue(value: string | null | undefined, unit: string) {
  if (value === null || value === undefined) return "—";
  const numeric = Number(value);
  const text = Number.isFinite(numeric)
    ? numeric.toFixed(Math.abs(numeric) >= 100 ? 0 : 1)
    : String(value);
  return unit ? `${text} ${unit}` : text;
}

export default async function PdmOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const rangeParam = Number(sp.range);
  const days: 1 | 7 | 30 =
    rangeParam === 7 ? 7 : rangeParam === 30 ? 30 : 1;
  const user = await requireUser();
  const manageable = canManage(user.role);
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 3600000);

  const [sensorRows, readingRows, alarmRows, suggestionRows, ruleRows, windowAlarmRows] =
    await Promise.all([
      db
        .select({
          sensor: pdmSensors,
          assetCode: assets.code,
          assetName: assets.name,
        })
        .from(pdmSensors)
        .innerJoin(assets, eq(pdmSensors.assetId, assets.id))
        .orderBy(asc(pdmSensors.code)),
      db
        .select({
          sensorId: pdmReadings.sensorId,
          value: pdmReadings.value,
          recordedAt: pdmReadings.recordedAt,
        })
        .from(pdmReadings)
        .where(gte(pdmReadings.recordedAt, since))
        .orderBy(asc(pdmReadings.recordedAt)),
      db
        .select({
          alarm: pdmAlarms,
          sensorCode: pdmSensors.code,
          sensorName: pdmSensors.name,
          unit: pdmSensors.unit,
          assetCode: assets.code,
          assetName: assets.name,
          ruleName: pdmRules.name,
        })
        .from(pdmAlarms)
        .innerJoin(pdmSensors, eq(pdmAlarms.sensorId, pdmSensors.id))
        .innerJoin(assets, eq(pdmAlarms.assetId, assets.id))
        .innerJoin(pdmRules, eq(pdmAlarms.ruleId, pdmRules.id))
        .where(inArray(pdmAlarms.status, ["open", "acknowledged"]))
        .orderBy(desc(pdmAlarms.lastTriggeredAt)),
      db
        .select({
          suggestion: pdmSuggestedWorkOrders,
          assetName: assets.name,
        })
        .from(pdmSuggestedWorkOrders)
        .innerJoin(assets, eq(pdmSuggestedWorkOrders.assetId, assets.id))
        .orderBy(desc(pdmSuggestedWorkOrders.createdAt)),
      db
        .select({ sensorId: pdmRules.sensorId })
        .from(pdmRules)
        .where(eq(pdmRules.active, true)),
      db
        .select({ severity: pdmAlarms.severity })
        .from(pdmAlarms)
        .where(gte(pdmAlarms.lastTriggeredAt, since)),
    ]);

  const seriesBySensor = new Map<string, number[]>();
  const latestBySensor = new Map<string, { value: number; at: Date }>();
  const bucketMode = days === 1 ? "hour" : "day";
  const bucketsBySensor = new Map<
    string,
    Map<string, { sum: number; count: number }>
  >();
  for (const row of readingRows) {
    const key = bucketKey(row.recordedAt, bucketMode);
    const sensorBuckets = bucketsBySensor.get(row.sensorId) ?? new Map();
    const cell = sensorBuckets.get(key) ?? { sum: 0, count: 0 };
    cell.sum += Number(row.value);
    cell.count += 1;
    sensorBuckets.set(key, cell);
    bucketsBySensor.set(row.sensorId, sensorBuckets);
    const previous = latestBySensor.get(row.sensorId);
    if (!previous || row.recordedAt > previous.at) {
      latestBySensor.set(row.sensorId, {
        value: Number(row.value),
        at: row.recordedAt,
      });
    }
  }
  for (const [sensorId, sensorBuckets] of bucketsBySensor) {
    seriesBySensor.set(
      sensorId,
      Array.from(sensorBuckets.values()).map(
        (cell) => cell.sum / (cell.count || 1),
      ),
    );
  }

  const rulesBySensor = new Map<string, number>();
  for (const row of ruleRows) {
    rulesBySensor.set(row.sensorId, (rulesBySensor.get(row.sensorId) ?? 0) + 1);
  }

  const activeSensors = sensorRows.filter((row) => row.sensor.active);
  const sortedAlarms = [...alarmRows].sort((a, b) => {
    const diff =
      (SEVERITY_ORDER[b.alarm.severity] ?? 0) -
      (SEVERITY_ORDER[a.alarm.severity] ?? 0);
    if (diff !== 0) return diff;
    return b.alarm.lastTriggeredAt.getTime() - a.alarm.lastTriggeredAt.getTime();
  });
  const criticalCount = sortedAlarms.filter(
    (row) => row.alarm.severity === "critical",
  ).length;
  const pendingSuggestions = suggestionRows.filter(
    (row) => row.suggestion.status === "pending",
  );
  const convertedSuggestions = suggestionRows.filter(
    (row) => row.suggestion.status === "converted",
  );

  const windowWarningCount = windowAlarmRows.filter(
    (row) => row.severity === "warning",
  ).length;
  const windowCriticalCount = windowAlarmRows.filter(
    (row) => row.severity === "critical",
  ).length;
  const healthScore = Math.max(
    0,
    Math.min(100, 100 - windowWarningCount * 10 - windowCriticalCount * 25),
  );
  const healthTone: "mint" | "honey" | "danger" =
    healthScore >= 85 ? "mint" : healthScore >= 60 ? "honey" : "danger";
  const healthLabel =
    healthScore >= 85 ? "状态良好" : healthScore >= 60 ? "需要关注" : "建议尽快检修";
  const healthClass = {
    mint: { text: "text-mint", panel: "bg-mint-soft/50 ring-mint/20" },
    honey: { text: "text-honey", panel: "bg-honey-soft/50 ring-honey/20" },
    danger: { text: "text-danger", panel: "bg-danger-soft ring-danger/20" },
  }[healthTone];
  const windowLabel = days === 1 ? "近 24 小时" : `近 ${days} 天`;

  return (
    <>
      <PageHeader
        eyebrow="Predictive · condition monitoring"
        title="预测性维护"
        description="采集设备振动、温度、电流等状态量，按阈值、持续时长、趋势斜率与组合条件自动评估，报警人工确认后转为建议工单，再由人决定是否转正式工单。全流程不自动停机。"
        actions={
          <>
            {manageable && (
              <LinkButton href="/admin/pdm/sensors" variant="secondary">
                <Gauge className="size-4" /> 测点与规则
              </LinkButton>
            )}
            <LinkButton href="/app/pdm/alarms" variant="secondary">
              <Bell className="size-4" /> 报警
            </LinkButton>
            <LinkButton href="/app/pdm/suggestions">
              <ClipboardText className="size-4" /> 建议工单
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="监测测点"
          value={activeSensors.length}
          tone="mint"
          icon={<Gauge className="size-4" />}
          sub={`共 ${sensorRows.length} 个测点 · ${ruleRows.length} 条启用规则`}
        />
        <StatCard
          label={days === 1 ? "24h 读数" : `${days} 天读数`}
          value={readingRows.length.toLocaleString("zh-CN")}
          tone="accent"
          icon={<Pulse className="size-4" />}
          sub="按小时 / 按天聚合后入图"
        />
        <StatCard
          label="待处理报警"
          value={sortedAlarms.length}
          tone="danger"
          icon={<Bell className="size-4" />}
          sub={`严重 ${criticalCount} 条`}
        />
        <StatCard
          label="待确认建议"
          value={pendingSuggestions.length}
          tone="honey"
          icon={<Wrench className="size-4" />}
          sub={`已转工单 ${convertedSuggestions.length} 条`}
        />
      </div>

      <section className="card mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div
            className={`flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl ring-1 ${healthClass.panel}`}
          >
            <span
              className={`font-mono text-[24px] leading-none ${healthClass.text}`}
            >
              {healthScore}
            </span>
            <span className="mt-1 text-[9px] text-muted">健康分</span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">
              设备健康评分
              <span className={healthClass.text}> · {healthLabel}</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {windowLabel}内按报警等级扣分：预警 −10、严重 −25，满分 100。当前预警{" "}
              {windowWarningCount} 次、严重 {windowCriticalCount} 次。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:ml-auto">
          {RANGES.map((item) => {
            const active = item === days;
            return (
              <Link
                key={item}
                href={`/app/pdm?range=${item}`}
                className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${
                  active
                    ? "bg-ink text-white"
                    : "border border-line bg-surface text-ink-soft hover:border-ink/25"
                }`}
              >
                {item === 1 ? "24 小时" : `${item} 天`}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card mt-4 p-5">
        <SectionTitle
          title="闭环流程"
          extra={<span className="label-mono">NO AUTO STOP</span>}
        />
        <div className="flex flex-col gap-2 text-[12px] sm:flex-row sm:items-center">
          {[
            { title: "采集读数", hint: "手工录入或网关 API 推送" },
            { title: "规则评估", hint: "阈值 / 持续 / 斜率 / 组合" },
            { title: "报警分级", hint: "提示 / 预警 / 严重" },
            { title: "建议工单", hint: "人工确认后生成" },
            { title: "正式工单", hint: "指派、执行、验收" },
          ].map((step, index) => (
            <div key={step.title} className="flex items-center gap-2">
              <div className="min-w-0 rounded-xl border border-line bg-paper/60 px-3 py-2">
                <p className="text-[11px] font-semibold">{step.title}</p>
                <p className="mt-0.5 text-[10px] text-muted">{step.hint}</p>
              </div>
              {index < 4 && (
                <ArrowRight className="hidden size-3.5 shrink-0 text-muted sm:block" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          报警只写入站内记录，不会触发设备停机或自动派工；建议工单必须由维修人员在
          /app/pdm/suggestions 人工确认后才生成正式工单。
        </p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">未关闭报警</h2>
            <Link
              href="/app/pdm/alarms"
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            >
              全部 <ArrowRight className="size-3" />
            </Link>
          </div>
          {sortedAlarms.length === 0 ? (
            <EmptyState
              icon={<Bell className="size-8" />}
              title="当前没有未关闭报警"
              hint="新读数越过规则条件后会自动生成报警。"
            />
          ) : (
            <ul className="divide-y divide-line">
              {sortedAlarms.slice(0, 6).map((row) => {
                const severity = PDM_SEVERITY[row.alarm.severity];
                const status = PDM_ALARM_STATUS[row.alarm.status];
                return (
                  <li key={row.alarm.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={severity?.tone ?? "neutral"}>
                        {severity?.label ?? row.alarm.severity}
                      </Badge>
                      <span className="text-[12px] font-medium">
                        {row.assetName}
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {row.sensorCode}
                      </span>
                      <Badge tone={status?.tone ?? "neutral"}>
                        {status?.label ?? row.alarm.status}
                      </Badge>
                      <span className="ml-auto font-mono text-[10px] text-muted">
                        {fmtDateTime(row.alarm.lastTriggeredAt)} · {row.alarm.occurrences} 次
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-soft">
                      {row.ruleName}：{row.alarm.message ?? "—"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {row.sensorName} · 当前 {formatValue(row.alarm.value, row.unit)} ·
                      阈值 {formatValue(row.alarm.threshold, row.unit)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">待确认建议工单</h2>
            <Link
              href="/app/pdm/suggestions"
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            >
              全部 <ArrowRight className="size-3" />
            </Link>
          </div>
          {pendingSuggestions.length === 0 ? (
            <EmptyState
              icon={<Wrench className="size-8" />}
              title="没有待确认建议"
              hint="在报警页选择“生成建议工单”，人工确认后再转正式工单。"
            />
          ) : (
            <ul className="divide-y divide-line">
              {pendingSuggestions.slice(0, 5).map((row) => {
                const status = PDM_SUGGESTION_STATUS[row.suggestion.status];
                return (
                  <li key={row.suggestion.id} className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted">
                        {row.suggestion.code}
                      </span>
                      <Badge tone={status?.tone ?? "neutral"}>
                        {status?.label ?? row.suggestion.status}
                      </Badge>
                      <span className="ml-auto text-[10px] text-muted">
                        {fmtDateTime(row.suggestion.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[12px] font-medium">
                      {row.suggestion.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {row.assetName} · 优先级{" "}
                      {row.suggestion.priority === "high"
                        ? "高"
                        : row.suggestion.priority === "urgent"
                          ? "紧急"
                          : row.suggestion.priority === "low"
                            ? "低"
                            : "中"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4 p-5">
        <SectionTitle
          title={days === 1 ? "近 24 小时测点趋势" : `近 ${days} 天测点趋势`}
          extra={
            <span className="label-mono">
              {days === 1 ? "LATEST 24H" : `LATEST ${days}D`}
            </span>
          }
        />
        {sensorRows.length === 0 ? (
          <EmptyState
            icon={<Gauge className="size-8" />}
            title="还没有配置测点"
            hint="先为关键设备创建振动、温度或电流测点，再配置报警规则。"
            action={
              manageable ? (
                <LinkButton href="/admin/pdm/sensors">新增测点</LinkButton>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sensorRows.map(({ sensor, assetCode, assetName }) => {
              const metric = PDM_METRIC[sensor.metric] ?? PDM_METRIC.other;
              const series = seriesBySensor.get(sensor.id) ?? [];
              const latest = latestBySensor.get(sensor.id);
              return (
                <Link
                  key={sensor.id}
                  href={
                    manageable
                      ? `/admin/pdm/sensors#sensor-${sensor.id}`
                      : `/app/pdm#sensor-${sensor.id}`
                  }
                  className="rounded-xl border border-line bg-paper/50 px-4 py-3 transition-colors hover:border-ink/25"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium">
                        {sensor.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                        {sensor.code} · {assetCode} {assetName}
                      </p>
                    </div>
                    <Badge tone={metric.tone}>{metric.label}</Badge>
                  </div>
                  <div className="mt-2">
                    <Sparkline points={series} tone={metric.tone} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
                    <span>
                      最新{" "}
                      <span className="font-mono text-ink">
                        {formatValue(
                          latest ? latest.value.toFixed(2) : null,
                          sensor.unit || metric.unit,
                        )}
                      </span>
                    </span>
                    <span>{rulesBySensor.get(sensor.id) ?? 0} 条规则</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
