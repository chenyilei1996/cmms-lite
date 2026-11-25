import { ArrowsClockwise, Bell, ClipboardText, Gauge, Plus, Pulse } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  pdmReadings,
  pdmRules,
  pdmSensors,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import {
  PDM_DIRECTION,
  PDM_METRIC,
  PDM_RULE_MODE,
  PDM_SEVERITY,
} from "@/lib/pdm";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";
import { Sparkline } from "@/components/sparkline";
import {
  addReading,
  createRule,
  createSensor,
  toggleRule,
  updateSensor,
} from "@/server/pdm-actions";

export const metadata = { title: "测点与规则" };

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatValue(value: string | null | undefined, unit: string) {
  if (value === null || value === undefined) return "—";
  const numeric = Number(value);
  const text = Number.isFinite(numeric)
    ? numeric.toFixed(Math.abs(numeric) >= 100 ? 0 : 1)
    : String(value);
  return unit ? `${text} ${unit}` : text;
}

function ruleCondition(rule: {
  mode: string;
  direction: string;
  threshold: string | null;
  durationMinutes: number | null;
  slopePerDay: string | null;
}) {
  const symbol = rule.direction === "below" ? "<" : ">";
  const threshold = rule.threshold ?? "—";
  if (rule.mode === "threshold") return `${symbol} ${threshold}`;
  if (rule.mode === "duration") {
    return `${symbol} ${threshold} 持续 ${rule.durationMinutes ?? 60} 分钟`;
  }
  if (rule.mode === "slope") {
    return `斜率 ${rule.direction === "below" ? "≤ -" : "≥ "}${rule.slopePerDay ?? "—"}/天`;
  }
  const parts = [`${symbol} ${threshold}`];
  if (rule.durationMinutes) parts.push(`持续 ${rule.durationMinutes} 分钟`);
  if (rule.slopePerDay) parts.push(`斜率 ${rule.slopePerDay}/天`);
  return parts.join(" + ");
}

export default async function PdmSensorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    alarms?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);
  const repairable = canRepair(user.role);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600000);
  const nowInput = toLocalInput(now);

  const [sensorRows, readingRows, ruleRows, machineRows] = await Promise.all([
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
    db.select().from(pdmRules).orderBy(asc(pdmRules.createdAt)),
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .where(
        inArray(assets.level, ["machine", "component"]),
      )
      .orderBy(asc(assets.code)),
  ]);

  const activeMachines = machineRows.filter(Boolean);

  const seriesBySensor = new Map<string, number[]>();
  const latestBySensor = new Map<string, { value: number; at: Date }>();
  for (const row of readingRows) {
    const list = seriesBySensor.get(row.sensorId) ?? [];
    list.push(Number(row.value));
    seriesBySensor.set(row.sensorId, list);
    const previous = latestBySensor.get(row.sensorId);
    if (!previous || row.recordedAt > previous.at) {
      latestBySensor.set(row.sensorId, {
        value: Number(row.value),
        at: row.recordedAt,
      });
    }
  }

  const rulesBySensor = new Map<string, typeof ruleRows>();
  for (const rule of ruleRows) {
    const list = rulesBySensor.get(rule.sensorId) ?? [];
    list.push(rule);
    rulesBySensor.set(rule.sensorId, list);
  }

  return (
    <>
      <PageHeader
        eyebrow="Predictive · sensors & rules"
        title="测点与规则"
        description="为关键设备配置振动、温度、电流等测点，维护读数并配置阈值、持续时长、趋势斜率或组合条件。规则命中只生成报警，不自动停机。"
        actions={
          <>
            <LinkButton href="/app/pdm" variant="secondary">
              <Gauge className="size-4" /> 预测总览
            </LinkButton>
            <LinkButton href="/app/pdm/alarms" variant="secondary">
              <Bell className="size-4" /> 报警
            </LinkButton>
            <LinkButton href="/app/pdm/suggestions" variant="secondary">
              <ClipboardText className="size-4" /> 建议工单
            </LinkButton>
          </>
        }
      />

      {sp.ok === "sensor" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          测点信息已保存。
        </p>
      )}
      {sp.ok === "rule" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          规则已保存，后续读数会按新规则评估。
        </p>
      )}
      {sp.ok === "reading" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          读数已录入
          {sp.alarms && Number(sp.alarms) > 0
            ? `，本次触发 ${sp.alarms} 条新报警，请到报警页处理。`
            : "，规则评估完成。"}
        </p>
      )}
      {sp.error === "sensor" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          请选择设备并填写测点编码与名称。
        </p>
      )}
      {sp.error === "duplicate" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          测点编码已存在，请换一个编码。
        </p>
      )}
      {sp.error === "rule" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          规则条件不完整：阈值/持续/斜率模式需要填写对应字段。
        </p>
      )}
      {sp.error === "reading" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          读数无效，请填写数字与合法时间。
        </p>
      )}

      {manageable && (
        <section className="card mb-4 p-5">
          <details>
            <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
              <Plus className="size-4 text-muted" /> 新增测点
            </summary>
            <form
              action={createSensor}
              className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className="text-[10px] text-muted">
                设备
                <select name="assetId" required className={`${inputClass} mt-1`}>
                  <option value="" disabled>
                    选择设备
                  </option>
                  {activeMachines.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.code} · {asset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted">
                测点编码
                <input
                  name="code"
                  required
                  placeholder="PDMS-01"
                  className={`${inputClass} mt-1 font-mono`}
                />
              </label>
              <label className="text-[10px] text-muted">
                测点名称
                <input
                  name="name"
                  required
                  placeholder="主轴振动"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted">
                监测类型
                <select name="metric" className={`${inputClass} mt-1`}>
                  {Object.entries(PDM_METRIC).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted">
                单位
                <input
                  name="unit"
                  placeholder="mm/s、℃、A"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted">
                安装位置
                <input
                  name="installLocation"
                  placeholder="选填"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <SubmitButton size="sm" className="h-9">
                  保存测点
                </SubmitButton>
              </div>
            </form>
          </details>
        </section>
      )}

      <section className="card mb-4 p-5">
        <SectionTitle
          title="读数推送 API"
          extra={<span className="label-mono">IOT INGEST</span>}
        />
        <p className="text-[11px] leading-relaxed text-muted">
          网关或采集程序可调用{" "}
          <code className="rounded bg-paper px-1 py-0.5 font-mono text-[10px]">
            POST /api/pdm/readings
          </code>
          ，请求头带{" "}
          <code className="rounded bg-paper px-1 py-0.5 font-mono text-[10px]">
            x-pdm-token: &lt;PDM_INGEST_TOKEN&gt;
          </code>
          。本地演示默认令牌为{" "}
          <code className="rounded bg-paper px-1 py-0.5 font-mono text-[10px]">
            dev-pdm-token
          </code>
          ，生产环境请通过环境变量覆盖。推送后会即时评估规则并生成报警。
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink px-4 py-3 text-[10px] leading-relaxed text-white/80">
{`curl -X POST http://localhost:3000/api/app/pdm/readings \\
  -H 'Content-Type: application/json' \\
  -H 'x-pdm-token: dev-pdm-token' \\
  -d '{"sensorCode":"PDMS-02","readings":[{"value":58.2}]}'`}
        </pre>
      </section>

      {sensorRows.length === 0 ? (
        <EmptyState
          icon={<Gauge className="size-8" />}
          title="还没有测点"
          hint="先新增一个测点，再录入读数并配置规则。"
        />
      ) : (
        <div className="space-y-4">
          {sensorRows.map(({ sensor, assetCode, assetName }) => {
            const metric = PDM_METRIC[sensor.metric] ?? PDM_METRIC.other;
            const unit = sensor.unit || metric.unit;
            const series = seriesBySensor.get(sensor.id) ?? [];
            const latest = latestBySensor.get(sensor.id);
            const rules = rulesBySensor.get(sensor.id) ?? [];
            return (
              <section
                key={sensor.id}
                id={`sensor-${sensor.id}`}
                className="card scroll-mt-20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-muted">
                        {sensor.code}
                      </span>
                      <h2 className="text-[15px] font-semibold">{sensor.name}</h2>
                      <Badge tone={metric.tone}>{metric.label}</Badge>
                      <Badge tone={sensor.active ? "mint" : "neutral"}>
                        {sensor.active ? "监测中" : "已停用"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      <Link
                        href={`/app/assets/${sensor.assetId}`}
                        className="hover:text-accent-ink"
                      >
                        {assetCode} · {assetName}
                      </Link>
                      {sensor.installLocation
                        ? ` · ${sensor.installLocation}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[22px] font-semibold leading-none tabular-nums">
                      {formatValue(
                        latest ? latest.value.toFixed(2) : null,
                        unit,
                      )}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      {latest ? fmtDateTime(latest.at) : "暂无读数"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                  <div>
                    <Sparkline points={series} tone={metric.tone} height={48} />
                    <p className="mt-1 text-[10px] text-muted">
                      近 24 小时 {series.length} 条读数
                    </p>
                  </div>
                  <div className="space-y-2">
                    {rules.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line px-3 py-3 text-[11px] text-muted">
                        还没有报警规则，读数不会触发报警。
                      </p>
                    ) : (
                      rules.map((rule) => {
                        const mode = PDM_RULE_MODE[rule.mode] ?? {
                          label: rule.mode,
                          hint: "",
                        };
                        const severity =
                          PDM_SEVERITY[rule.severity] ?? PDM_SEVERITY.warning;
                        return (
                          <div
                            key={rule.id}
                            className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper/50 px-3 py-2"
                          >
                            <span className="text-[11px] font-medium">
                              {rule.name}
                            </span>
                            <Badge tone="neutral">{mode.label}</Badge>
                            <Badge tone={severity.tone}>{severity.label}</Badge>
                            <span className="font-mono text-[10px] text-muted">
                              {ruleCondition(rule)}
                              {unit ? ` ${unit}` : ""}
                            </span>
                            {!rule.active && (
                              <Badge tone="neutral">已停用</Badge>
                            )}
                            {manageable && (
                              <form action={toggleRule} className="ml-auto">
                                <input type="hidden" name="id" value={rule.id} />
                                <input
                                  type="hidden"
                                  name="active"
                                  value={rule.active ? "0" : "1"}
                                />
                                {rule.active ? (
                                  <ConfirmSubmitButton
                                    message={`停用该规则后不再产生新报警，已有报警保留。确认停用「${rule.name ?? "该规则"}」？`}
                                    className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-danger"
                                  >
                                    <ArrowsClockwise className="size-3" /> 停用
                                  </ConfirmSubmitButton>
                                ) : (
                                  <button
                                    type="submit"
                                    className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-ink"
                                  >
                                    <ArrowsClockwise className="size-3" /> 启用
                                  </button>
                                )}
                              </form>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {repairable && (
                  <details className="mt-3 border-t border-line pt-3">
                    <summary className="cursor-pointer text-[11px] font-medium text-ink-soft">
                      录入读数
                    </summary>
                    <form
                      action={addReading}
                      className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <input type="hidden" name="sensorId" value={sensor.id} />
                      <label className="text-[10px] text-muted">
                        读数（{unit || "数值"}）
                        <input
                          name="value"
                          type="number"
                          step="0.001"
                          required
                          className={`${inputClass} mt-1 font-mono`}
                        />
                      </label>
                      <label className="text-[10px] text-muted">
                        采集时间
                        <input
                          name="recordedAt"
                          type="datetime-local"
                          defaultValue={nowInput}
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                      <div className="flex items-end">
                        <SubmitButton size="sm" className="h-9">
                          <Pulse className="size-3.5" /> 保存读数
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                )}

                {manageable && (
                  <details className="mt-3 border-t border-line pt-3">
                    <summary className="cursor-pointer text-[11px] font-medium text-ink-soft">
                      新增规则 / 编辑测点
                    </summary>
                    <form
                      action={createRule}
                      className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                    >
                      <input type="hidden" name="sensorId" value={sensor.id} />
                      <label className="text-[10px] text-muted sm:col-span-2">
                        规则名称
                        <input
                          name="name"
                          required
                          placeholder="温度预警"
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                      <label className="text-[10px] text-muted">
                        规则类型
                        <select name="mode" className={`${inputClass} mt-1`}>
                          {Object.entries(PDM_RULE_MODE).map(([key, meta]) => (
                            <option key={key} value={key}>
                              {meta.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] text-muted">
                        报警分级
                        <select
                          name="severity"
                          defaultValue="warning"
                          className={`${inputClass} mt-1`}
                        >
                          {Object.entries(PDM_SEVERITY).map(([key, meta]) => (
                            <option key={key} value={key}>
                              {meta.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] text-muted">
                        方向
                        <select name="direction" className={`${inputClass} mt-1`}>
                          {Object.entries(PDM_DIRECTION).map(([key, meta]) => (
                            <option key={key} value={key}>
                              {meta.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] text-muted">
                        阈值
                        <input
                          name="threshold"
                          type="number"
                          step="0.001"
                          className={`${inputClass} mt-1 font-mono`}
                        />
                      </label>
                      <label className="text-[10px] text-muted">
                        持续时长（分钟）
                        <input
                          name="durationMinutes"
                          type="number"
                          min={1}
                          placeholder="持续/组合模式"
                          className={`${inputClass} mt-1 font-mono`}
                        />
                      </label>
                      <label className="text-[10px] text-muted">
                        斜率（/天）
                        <input
                          name="slopePerDay"
                          type="number"
                          step="0.001"
                          placeholder="斜率/组合模式"
                          className={`${inputClass} mt-1 font-mono`}
                        />
                      </label>
                      <label className="text-[10px] text-muted sm:col-span-2 lg:col-span-3">
                        备注
                        <input
                          name="note"
                          placeholder="维护建议、停机风险说明（选填）"
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                      <div className="flex items-end">
                        <SubmitButton size="sm" className="h-9 w-full">
                          保存规则
                        </SubmitButton>
                      </div>
                    </form>

                    <form
                      action={updateSensor}
                      className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-5"
                    >
                      <input type="hidden" name="id" value={sensor.id} />
                      <label className="text-[10px] text-muted">
                        测点名称
                        <input
                          name="name"
                          defaultValue={sensor.name}
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                      <label className="text-[10px] text-muted">
                        监测类型
                        <select
                          name="metric"
                          defaultValue={sensor.metric}
                          className={`${inputClass} mt-1`}
                        >
                          {Object.entries(PDM_METRIC).map(([key, meta]) => (
                            <option key={key} value={key}>
                              {meta.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] text-muted">
                        单位
                        <input
                          name="unit"
                          defaultValue={sensor.unit}
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                      <label className="text-[10px] text-muted">
                        安装位置
                        <input
                          name="installLocation"
                          defaultValue={sensor.installLocation ?? ""}
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                      <div className="flex items-end gap-3">
                        <label className="flex h-9 items-center gap-1.5 text-[10px] text-muted">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={sensor.active}
                          />
                          启用
                        </label>
                        <SubmitButton size="sm" variant="secondary" className="h-9">
                          保存测点
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
