import { ArrowRight, Bell, Check, ClipboardText, Gauge, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  pdmAlarms,
  pdmRules,
  pdmSensors,
  pdmSuggestedWorkOrders,
  users,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import {
  PDM_ALARM_STATUS,
  PDM_SEVERITY,
} from "@/lib/pdm";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ui-client";
import {
  acknowledgeAlarm,
  createSuggestion,
  dismissAlarm,
} from "@/server/pdm-actions";

export const metadata = { title: "预测报警" };

const FILTERS = [
  { key: "active", label: "未关闭" },
  { key: "all", label: "全部" },
  { key: "converted", label: "已转建议" },
  { key: "dismissed", label: "已忽略" },
];

function formatValue(value: string | null | undefined, unit: string) {
  if (value === null || value === undefined) return "—";
  const numeric = Number(value);
  const text = Number.isFinite(numeric)
    ? numeric.toFixed(Math.abs(numeric) >= 100 ? 0 : 1)
    : String(value);
  return unit ? `${text} ${unit}` : text;
}

export default async function PdmAlarmsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const repairable = canRepair(user.role);
  const manageable = canManage(user.role);
  const filter = FILTERS.some((item) => item.key === sp.status)
    ? sp.status!
    : "active";

  const where =
    filter === "all"
      ? undefined
      : filter === "active"
        ? inArray(pdmAlarms.status, ["open", "acknowledged"])
        : eq(pdmAlarms.status, filter as "converted" | "dismissed");

  const [alarmRows, suggestionRows] = await Promise.all([
    db
      .select({
        alarm: pdmAlarms,
        sensorCode: pdmSensors.code,
        sensorName: pdmSensors.name,
        unit: pdmSensors.unit,
        assetCode: assets.code,
        assetName: assets.name,
        ruleName: pdmRules.name,
        ackName: users.name,
      })
      .from(pdmAlarms)
      .innerJoin(pdmSensors, eq(pdmAlarms.sensorId, pdmSensors.id))
      .innerJoin(assets, eq(pdmAlarms.assetId, assets.id))
      .innerJoin(pdmRules, eq(pdmAlarms.ruleId, pdmRules.id))
      .leftJoin(users, eq(pdmAlarms.acknowledgedById, users.id))
      .where(where)
      .orderBy(desc(pdmAlarms.lastTriggeredAt))
      .limit(120),
    db
      .select({
        alarmId: pdmSuggestedWorkOrders.alarmId,
        status: pdmSuggestedWorkOrders.status,
        code: pdmSuggestedWorkOrders.code,
      })
      .from(pdmSuggestedWorkOrders),
  ]);

  const suggestionByAlarm = new Map<
    string,
    { status: string; code: string }
  >();
  for (const row of suggestionRows) {
    if (row.alarmId) {
      suggestionByAlarm.set(row.alarmId, { status: row.status, code: row.code });
    }
  }

  const activeRows = alarmRows.filter((row) =>
    ["open", "acknowledged"].includes(row.alarm.status),
  );
  const critical = activeRows.filter(
    (row) => row.alarm.severity === "critical",
  ).length;
  const warning = activeRows.filter(
    (row) => row.alarm.severity === "warning",
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Predictive · alarms"
        title="预测报警"
        description="规则命中的报警按提示、预警、严重分级。可确认、忽略，或生成建议工单等待人工转正式工单；报警本身不会停机。"
        actions={
          <>
            <LinkButton href="/app/pdm" variant="secondary">
              <Gauge className="size-4" /> 预测总览
            </LinkButton>
            {manageable && (
              <LinkButton href="/admin/pdm/sensors" variant="secondary">
                测点与规则
              </LinkButton>
            )}
            <LinkButton href="/app/pdm/suggestions">
              <ClipboardText className="size-4" /> 建议工单
            </LinkButton>
          </>
        }
      />

      {sp.ok === "ack" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          报警已确认，可继续生成建议工单。
        </p>
      )}
      {sp.ok === "dismiss" && (
        <p className="mb-4 rounded-xl bg-paper px-4 py-3 text-[12px] text-muted">
          报警已忽略。
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="未关闭报警"
          value={activeRows.length}
          tone="danger"
          icon={<Bell className="size-4" />}
          sub="待处理 + 已确认"
        />
        <StatCard
          label="严重"
          value={critical}
          tone="danger"
          sub="需优先确认"
        />
        <StatCard label="预警" value={warning} tone="honey" sub="计划检修" />
        <StatCard
          label="已转建议"
          value={alarmRows.filter((row) => row.alarm.status === "converted").length}
          tone="mint"
          sub="等待人工转工单"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/app/pdm/alarms?status=${item.key}`}
            className={`inline-flex h-9 items-center rounded-full border px-4 text-[12px] transition-colors ${
              filter === item.key
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-soft hover:border-ink/25"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <span className="ml-auto text-[11px] text-muted">
          展示 {alarmRows.length} 条
        </span>
      </div>

      {alarmRows.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-8" />}
          title="没有符合条件的报警"
          hint="录入或推送新读数后，规则命中会自动生成报警。"
          action={
            manageable ? (
              <LinkButton href="/admin/pdm/sensors">去录入读数</LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {alarmRows.map((row) => {
            const severity = PDM_SEVERITY[row.alarm.severity] ?? PDM_SEVERITY.warning;
            const status = PDM_ALARM_STATUS[row.alarm.status];
            const suggestion = suggestionByAlarm.get(row.alarm.id);
            const canHandle = ["open", "acknowledged"].includes(
              row.alarm.status,
            );
            return (
              <section key={row.alarm.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={severity.tone}>{severity.label}</Badge>
                      <Badge tone={status?.tone ?? "neutral"}>
                        {status?.label ?? row.alarm.status}
                      </Badge>
                      <span className="text-[13px] font-semibold">
                        {row.assetName}
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {row.assetCode} · {row.sensorCode}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] text-ink-soft">
                      {row.ruleName}：{row.alarm.message ?? "—"}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      测点 {row.sensorName} · 当前{" "}
                      {formatValue(row.alarm.value, row.unit)} · 阈值{" "}
                      {formatValue(row.alarm.threshold, row.unit)} · 累计{" "}
                      {row.alarm.occurrences} 次 · 首次{" "}
                      {fmtDateTime(row.alarm.triggeredAt)} · 最近{" "}
                      {fmtDateTime(row.alarm.lastTriggeredAt)}
                    </p>
                    {row.alarm.acknowledgedAt && (
                      <p className="mt-1 text-[10px] text-muted">
                        处理人 {row.ackName ?? "—"} ·{" "}
                        {fmtDateTime(row.alarm.acknowledgedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {repairable && row.alarm.status === "open" && (
                      <form action={acknowledgeAlarm}>
                        <input type="hidden" name="id" value={row.alarm.id} />
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-[11px] hover:border-ink/30"
                        >
                          <Check className="size-3.5" /> 确认
                        </button>
                      </form>
                    )}
                    {repairable && canHandle && (
                      <>
                        {!suggestion && (
                          <form action={createSuggestion}>
                            <input
                              type="hidden"
                              name="alarmId"
                              value={row.alarm.id}
                            />
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-[11px] text-white hover:bg-ink-soft"
                            >
                              <ClipboardText className="size-3.5" /> 生成建议工单
                            </button>
                          </form>
                        )}
                        <form action={dismissAlarm}>
                          <input type="hidden" name="id" value={row.alarm.id} />
                          <ConfirmSubmitButton
                            message="忽略这条报警？忽略后不再出现在待处理列表，也不会生成工单。"
                            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] text-muted hover:text-danger"
                          >
                            <X className="size-3.5" /> 忽略
                          </ConfirmSubmitButton>
                        </form>
                      </>
                    )}
                    {suggestion && (
                      <Link
                        href="/app/pdm/suggestions"
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-soft px-3 text-[11px] text-accent-ink"
                      >
                        {suggestion.code}
                        <ArrowRight className="size-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
