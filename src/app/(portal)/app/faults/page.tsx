import { ArrowRight, BookOpenText, Clock, Gauge, Plus, Pulse, Warning, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { DOWNTIME_TYPE, RESPONSIBILITY } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";
import { getAiPanelData } from "@/server/ai-analysis";
import { loadFaultsAnalytics, toLocalInput } from "@/server/faults-analytics";
import {
  createDowntimeRecord,
  deleteDowntimeRecord,
} from "@/server/reliability-actions";

export const metadata = { title: "故障与停机分析" };

const PERIODS = [
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
  { days: 365, label: "近 1 年" },
];

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

function duration(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

export default async function FaultsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);
  const repairable = canRepair(user.role);
  const days = PERIODS.some((item) => String(item.days) === sp.days)
    ? Number(sp.days)
    : 30;

  const analytics = await loadFaultsAnalytics(days);
  const {
    now,
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
  } = analytics;

  const ai = repairable
    ? await getAiPanelData(days, fingerprint, user)
    : null;

  const defaultStart = toLocalInput(new Date(now.getTime() - 3600000));
  const defaultEnd = toLocalInput(now);

  return (
    <>
      <PageHeader
        eyebrow="Reliability · downtime"
        title="故障与停机分析"
        description="标准化故障代码、停机原因与责任归属，自动计算 MTTR / MTBF，定位高频故障设备与故障类型。"
        actions={
          <>
            {manageable && (
              <LinkButton href="/admin/faults/codes" variant="secondary">
                <BookOpenText className="size-4" /> 故障代码库
              </LinkButton>
            )}
            <LinkButton href="/app/work-orders" variant="secondary">
              <Wrench className="size-4" /> 工单
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PERIODS.map((period) => (
          <Link
            key={period.days}
            href={`/app/faults?days=${period.days}`}
            className={`inline-flex h-9 items-center rounded-full border px-4 text-[12px] transition-colors ${
              days === period.days
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-soft hover:border-ink/25"
            }`}
          >
            {period.label}
          </Link>
        ))}
        <span className="ml-auto text-[11px] text-muted">
          {machineCount} 台设备纳入 MTBF 计算
        </span>
      </div>

      {sp.error === "time" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          结束时间必须晚于开始时间，停机记录未保存。
        </p>
      )}
      {sp.ok && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          停机记录已保存，分析指标已更新。
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="故障次数"
          value={faultCount}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub="非计划停机事件"
        />
        <StatCard
          label="总停机时长"
          value={duration(totalMinutes)}
          tone="honey"
          icon={<Clock className="size-4" />}
          sub="含计划停机"
        />
        <StatCard
          label="MTTR"
          value={mttr === null ? "—" : duration(mttr)}
          tone="accent"
          icon={<Pulse className="size-4" />}
          sub="平均修复时长"
        />
        <StatCard
          label="MTBF"
          value={
            mtbfHours === null
              ? "—"
              : `${Math.round(mtbfHours).toLocaleString("zh-CN")} h`
          }
          tone="mint"
          icon={<Gauge className="size-4" />}
          sub="平均故障间隔"
        />
        <StatCard
          label="影响产量"
          value={affectedTotal.toLocaleString("zh-CN")}
          tone="neutral"
          icon={<Warning className="size-4" />}
          sub="按停机记录汇总"
        />
      </div>

      {ai && (
        <AiAnalysisPanel
          days={days}
          ready={ai.ready}
          model={ai.model}
          triggerMode={ai.triggerMode}
          canConfigure={ai.canConfigure}
          initial={ai.initial}
          history={ai.history}
        />
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5 lg:col-span-2">
          <SectionTitle
            title="近 14 天停机趋势"
            extra={<span className="label-mono">MINUTES / DAY</span>}
          />
          <div className="flex h-40 items-end gap-1.5 sm:gap-2">
            {trend.map((item) => (
              <div
                key={item.label}
                className="group flex flex-1 flex-col items-center gap-1"
                title={`${item.label} · ${item.minutes} 分钟 · ${item.count} 次故障`}
              >
                <span className="text-[9px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  {item.minutes}
                </span>
                <div className="flex h-full w-full items-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      item.minutes > 0 ? "bg-accent/70" : "bg-paper"
                    }`}
                    style={{
                      height: `${Math.max(
                        item.minutes > 0 ? 6 : 2,
                        (item.minutes / maxTrend) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">故障 TOP</h2>
            <span className="label-mono">BY CODE</span>
          </div>
          {topCodes.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">
              当前周期没有非计划停机记录。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {topCodes.map((item) => (
                <li key={`${item.code}-${item.name}`} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-[10px] text-muted">
                        {item.code}
                      </span>{" "}
                      <span className="font-medium">{item.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {item.count} 次 · {duration(item.minutes)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-danger/70"
                      style={{
                        width: `${Math.max(6, (item.count / maxCodeCount) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">设备停机 TOP</h2>
            <span className="label-mono">BY DOWNTIME</span>
          </div>
          {topAssets.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">
              当前周期没有非计划停机记录。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {topAssets.map((item) => (
                <li key={item.code} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate font-medium">
                      {item.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {item.count} 次 · {duration(item.minutes)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-honey/80"
                      style={{
                        width: `${Math.max(6, (item.minutes / maxAssetMinutes) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <SectionTitle
            title="责任归属"
            extra={<span className="label-mono">UNPLANNED</span>}
          />
          {responsibilityStats.size === 0 ? (
            <p className="text-[12px] text-muted">暂无数据。</p>
          ) : (
            <div className="space-y-3">
              {[...responsibilityStats.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .map(([key, stat]) => {
                  const meta = RESPONSIBILITY[key] ?? {
                    label: key,
                    tone: "neutral" as const,
                  };
                  const percent = faultCount
                    ? Math.round((stat.count / faultCount) * 100)
                    : 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-[11px]">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="font-mono text-muted">
                          {stat.count} 次 · {percent}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper">
                        <div
                          className="h-full rounded-full bg-ink/60"
                          style={{ width: `${Math.max(4, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        <section className="card p-5">
          <SectionTitle
            title="停机结构"
            extra={<span className="label-mono">PLANNED / UNPLANNED</span>}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-danger-soft/60 px-4 py-3">
              <p className="text-[10px] text-danger">非计划停机</p>
              <p className="mt-1 font-mono text-[22px] font-semibold text-danger">
                {duration(unplannedMinutes)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                {faultCount} 次 · MTTR{" "}
                {mttr === null ? "—" : `${mttr} 分`}
              </p>
            </div>
            <div className="rounded-xl bg-mint-soft/60 px-4 py-3">
              <p className="text-[10px] text-mint">计划停机</p>
              <p className="mt-1 font-mono text-[22px] font-semibold text-mint">
                {duration(Math.max(0, totalMinutes - unplannedMinutes))}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                PM / 项目 / 保养
              </p>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted">
            MTBF 以周期内设备可用时间（{days} 天 × 24 小时 × {machineCount} 台）扣除总停机时间后，除以非计划故障次数计算。
          </p>
        </section>
      </div>

      {repairable && manageable && (
        <section className="card mt-4 p-5">
          <details>
            <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
              <Plus className="size-4 text-muted" /> 补录停机记录
            </summary>
            <form
              action={createDowntimeRecord}
              className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
            >
              <label className="text-[10px] text-muted">
                设备
                <select name="assetId" required className={`${inputClass} mt-1`}>
                  <option value="" disabled>
                    选择设备
                  </option>
                  {assetRows.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.code} · {asset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted">
                关联工单
                <select name="workOrderId" className={`${inputClass} mt-1`}>
                  <option value="">不关联工单</option>
                  {woRows.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.code} · {wo.assetName} · {wo.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted">
                故障代码
                <select name="faultCodeId" className={`${inputClass} mt-1`}>
                  <option value="">未分类</option>
                  {codeRows.map((code) => (
                    <option key={code.id} value={code.id}>
                      {code.code} · {code.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted">
                停机类型
                <select name="type" className={`${inputClass} mt-1`}>
                  <option value="unplanned">非计划停机</option>
                  <option value="planned">计划停机</option>
                </select>
              </label>
              <label className="text-[10px] text-muted">
                开始时间
                <input
                  name="startedAt"
                  type="datetime-local"
                  required
                  defaultValue={defaultStart}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted">
                结束时间
                <input
                  name="endedAt"
                  type="datetime-local"
                  defaultValue={defaultEnd}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted">
                责任归属
                <select
                  name="responsibility"
                  className={`${inputClass} mt-1`}
                >
                  {Object.entries(RESPONSIBILITY).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted">
                影响产量
                <input
                  name="affectedOutput"
                  type="number"
                  min={0}
                  placeholder="件 / 台（选填）"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted sm:col-span-2 lg:col-span-3">
                备注
                <input
                  name="note"
                  placeholder="停机现象、处理说明（选填）"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <div className="flex items-end">
                <SubmitButton size="sm" className="h-9 w-full">
                  保存记录
                </SubmitButton>
              </div>
            </form>
          </details>
        </section>
      )}

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">停机记录</h2>
          <span className="label-mono">{recordRows.length} RECORDS</span>
        </div>
        {recordRows.length === 0 ? (
          <EmptyState
            icon={<Pulse className="size-8" />}
            title="当前周期没有停机记录"
            hint="完成故障工单会自动生成停机记录，也可以手动补录无工单的停机。"
          />
        ) : (
          <ul className="divide-y divide-line">
            {recordRows.slice(0, 12).map(({ record, assetName, assetCode, faultCode, faultName, workOrderCode }) => {
              const typeMeta = DOWNTIME_TYPE[record.type];
              const respMeta = RESPONSIBILITY[record.responsibility];
              return (
                <li
                  key={record.id}
                  className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Badge tone={typeMeta.tone}>{typeMeta.label}</Badge>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium">
                        <Link
                          href={`/app/assets/${record.assetId}`}
                          className="hover:text-accent-ink"
                        >
                          {assetName}
                        </Link>
                        <span className="ml-2 font-mono text-[10px] font-normal text-muted">
                          {assetCode}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted">
                        {fmtDateTime(record.startedAt)} →{" "}
                        {record.endedAt ? fmtDateTime(record.endedAt) : "进行中"}
                        {faultCode ? ` · ${faultCode} ${faultName ?? ""}` : " · 未分类"}
                        {workOrderCode ? ` · ${workOrderCode}` : ""}
                        {record.note ? ` · ${record.note}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-0 sm:pl-4">
                    <Badge tone={respMeta?.tone ?? "neutral"}>
                      {respMeta?.label ?? record.responsibility}
                    </Badge>
                    <span className="font-mono text-[11px] text-ink-soft">
                      {duration(record.minutes)}
                    </span>
                    {record.affectedOutput !== null && (
                      <span className="text-[10px] text-muted">
                        影响 {record.affectedOutput}
                      </span>
                    )}
                    {manageable && !record.workOrderId && (
                      <form action={deleteDowntimeRecord}>
                        <input type="hidden" name="id" value={record.id} />
                        <ConfirmSubmitButton
                          message="删除这条停机记录？删除后无法恢复，统计口径也会同步变化。"
                          className="text-[10px] text-muted hover:text-danger"
                        >
                          删除
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {recordRows.length > 12 && (
          <div className="border-t border-line px-5 py-3 text-right">
            <Link
              href={`/app/faults?days=${days}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            >
              仅展示最近 12 条 <ArrowRight className="size-3" />
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
