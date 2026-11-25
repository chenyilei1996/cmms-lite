import { ArrowRight, ArrowsClockwise, CheckCircle, Database, FlowArrow, Play, Plug, Plus, Tray, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  integrationEndpoints,
  integrationMockMessages,
  syncJobs,
  syncRecords,
  syncRuns,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import {
  INTEGRATION_SYSTEM,
  SYNC_DATASET,
  SYNC_DIRECTION,
  SYNC_RUN_STATUS,
  datasetsFor,
} from "@/lib/integration";
import { fmtDateTime, pct, timeAgo } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import {
  createSyncJob,
  runSyncJob,
  toggleSyncJob,
} from "@/server/integration-actions";

export const metadata = { title: "集成中心" };

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

const ASSET_PAYLOAD_EXAMPLE = `{
  "items": [
    {
      "code": "AZ-1001",
      "name": "冲压机 A 线",
      "category": "冲压设备",
      "level": "machine",
      "status": "in_service",
      "criticality": "A",
      "parentCode": "AZ-1000",
      "locationCode": "LOC-001",
      "manufacturer": "江苏锻压",
      "model": "JC21-160",
      "serialNo": "SN2024001",
      "purchaseDate": "2024-03-01",
      "purchaseCost": 560000
    }
  ]
}`;

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);
  const weekAgo = sql`now() - interval '7 days'`;

  const [endpointRows, jobRows, runRows, pendingRows, problemRows, weekRuns] =
    await Promise.all([
      db.select().from(integrationEndpoints).orderBy(asc(integrationEndpoints.code)),
      db
        .select({
          job: syncJobs,
          endpointName: integrationEndpoints.name,
          endpointCode: integrationEndpoints.code,
          endpointSystem: integrationEndpoints.system,
          endpointMock: integrationEndpoints.mock,
          endpointEnabled: integrationEndpoints.enabled,
        })
        .from(syncJobs)
        .innerJoin(
          integrationEndpoints,
          eq(syncJobs.endpointId, integrationEndpoints.id),
        )
        .orderBy(asc(syncJobs.code)),
      db
        .select({
          run: syncRuns,
          jobCode: syncJobs.code,
          jobName: syncJobs.name,
          endpointName: integrationEndpoints.name,
        })
        .from(syncRuns)
        .innerJoin(syncJobs, eq(syncRuns.jobId, syncJobs.id))
        .innerJoin(
          integrationEndpoints,
          eq(syncJobs.endpointId, integrationEndpoints.id),
        )
        .orderBy(desc(syncRuns.startedAt))
        .limit(8),
      db
        .select({ endpointId: integrationMockMessages.endpointId })
        .from(integrationMockMessages)
        .where(eq(integrationMockMessages.status, "pending")),
      db
        .select({ n: count() })
        .from(syncRecords)
        .where(
          and(
            inArray(syncRecords.status, ["conflict", "failed"]),
            gte(syncRecords.createdAt, weekAgo),
          ),
        ),
      db
        .select({ status: syncRuns.status })
        .from(syncRuns)
        .where(gte(syncRuns.startedAt, weekAgo)),
    ]);

  const pendingByEndpoint = new Map<string, number>();
  for (const row of pendingRows) {
    pendingByEndpoint.set(
      row.endpointId,
      (pendingByEndpoint.get(row.endpointId) ?? 0) + 1,
    );
  }

  const enabledEndpoints = endpointRows.filter((row) => row.enabled).length;
  const enabledJobs = jobRows.filter((row) => row.job.enabled).length;
  const okRuns = weekRuns.filter(
    (row) => row.status === "success" || row.status === "partial",
  ).length;
  const successRate = pct(okRuns, weekRuns.length);
  const problemCount = Number(problemRows[0]?.n ?? 0);
  const pendingTotal = pendingRows.length;

  return (
    <>
      <PageHeader
        eyebrow="Integration · MES / ERP"
        title="集成中心"
        description="统一管理 MES、ERP、WMS 的主数据与工单同步：可配置 Mock 对端先行联调，支持幂等键、失败重试与对账差异跟踪，后续切换真实接口只需修改端点地址与令牌。"
        actions={
          <>
            <LinkButton href="/admin/integrations/endpoints" variant="secondary">
              <Plug className="size-4" /> 端点配置
            </LinkButton>
            <LinkButton href="/admin/integrations/mock" variant="secondary">
              <Tray className="size-4" /> Mock 对端
            </LinkButton>
            <LinkButton href="/admin/integrations/runs" variant="secondary">
              <ArrowsClockwise className="size-4" /> 运行记录
            </LinkButton>
            <LinkButton href="/admin/integrations/reconcile">
              <CheckCircle className="size-4" /> 对账
            </LinkButton>
          </>
        }
      />

      {sp.ok === "job-created" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          同步任务已创建，可在下方点击“立即同步”验证链路。
        </p>
      )}
      {sp.ok === "job-toggled" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          同步任务状态已更新。
        </p>
      )}
      {sp.error === "forbidden" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          当前角色无集成配置权限。
        </p>
      )}
      {sp.error === "job-fields" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          请填写任务编码、名称并选择端点、数据集与方向。
        </p>
      )}
      {sp.error === "job-dataset" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          该数据集不支持所选方向：拉取仅支持设备主数据与维修工单。
        </p>
      )}
      {sp.error === "job-duplicate" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          任务编码已存在，请换一个编码。
        </p>
      )}
      {sp.error === "job-disabled" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          任务已停用，启用后才能执行同步。
        </p>
      )}
      {sp.error === "job-missing" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          同步任务不存在或已被删除。
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="启用端点"
          value={enabledEndpoints}
          tone="mint"
          icon={<Plug className="size-4" />}
          sub={`共 ${endpointRows.length} 个端点 · Mock ${endpointRows.filter((row) => row.mock).length} 个`}
        />
        <StatCard
          label="同步任务"
          value={enabledJobs}
          tone="accent"
          icon={<FlowArrow className="size-4" />}
          sub={`共 ${jobRows.length} 个任务 · 近 7 天成功率 ${successRate}%`}
        />
        <StatCard
          label="待拉取报文"
          value={pendingTotal}
          tone="honey"
          icon={<Tray className="size-4" />}
          sub="Mock 对端已就绪、等待拉取"
        />
        <StatCard
          label="待处理差异"
          value={problemCount}
          tone={problemCount ? "danger" : "neutral"}
          icon={<Warning className="size-4" />}
          sub="近 7 天冲突 / 失败记录"
        />
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[13px] font-semibold">同步任务</h2>
            <p className="mt-0.5 text-[10px] text-muted">
              每个任务绑定一个端点与数据集，重复执行按幂等键自动跳过
            </p>
          </div>
          <Link
            href="/admin/integrations/runs"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
          >
            运行记录 <ArrowRight className="size-3" />
          </Link>
        </div>

        {jobRows.length === 0 ? (
          <EmptyState
            icon={<FlowArrow className="size-8" />}
            title="还没有同步任务"
            hint="先在端点配置中创建 MES / ERP 端点，再新增同步任务。"
            action={<LinkButton href="/admin/integrations/endpoints">配置端点</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {jobRows.map(({ job, endpointName, endpointCode, endpointSystem, endpointMock, endpointEnabled }) => {
              const system = INTEGRATION_SYSTEM[endpointSystem];
              const dataset = SYNC_DATASET[job.dataset];
              const direction = SYNC_DIRECTION[job.direction];
              const lastStatus = job.lastStatus
                ? SYNC_RUN_STATUS[job.lastStatus]
                : null;
              return (
                <li key={job.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-muted">
                          {job.code}
                        </span>
                        <span className="text-[13px] font-semibold">{job.name}</span>
                        <Badge tone={direction.tone}>{direction.label}</Badge>
                        <Badge tone="neutral">{dataset.label}</Badge>
                        <Badge tone={job.enabled ? "mint" : "neutral"}>
                          {job.enabled ? "启用" : "停用"}
                        </Badge>
                        {lastStatus ? (
                          <Badge tone={lastStatus.tone}>{lastStatus.label}</Badge>
                        ) : (
                          <Badge tone="neutral">未运行</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        <Link
                          href="/admin/integrations/endpoints"
                          className="hover:text-accent-ink"
                        >
                          {endpointCode} · {endpointName}
                        </Link>
                        {system ? ` · ${system.label}` : ""}
                        {endpointMock ? " · Mock 对端" : " · 真实接口"}
                        {!endpointEnabled ? " · 端点已停用" : ""}
                        {` · 建议间隔 ${job.intervalMinutes} 分钟`}
                      </p>
                      {job.note && (
                        <p className="mt-1 text-[10px] text-muted">{job.note}</p>
                      )}
                      <p className="mt-1 text-[10px] text-muted">
                        最近运行：
                        {job.lastRunAt
                          ? `${fmtDateTime(job.lastRunAt)} · ${timeAgo(job.lastRunAt)}`
                          : "尚未运行"}
                      </p>
                    </div>
                    {manageable && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <form action={runSyncJob}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <SubmitButton
                            size="sm"
                            className="h-8"
                            disabled={!job.enabled || !endpointEnabled}
                          >
                            <Play className="size-3.5" /> 立即同步
                          </SubmitButton>
                        </form>
                        <form action={toggleSyncJob}>
                          <input type="hidden" name="id" value={job.id} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={job.enabled ? "0" : "1"}
                          />
                          <SubmitButton variant="secondary" size="sm" className="h-8">
                            {job.enabled ? "停用" : "启用"}
                          </SubmitButton>
                        </form>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {manageable && (
        <section className="card mt-4 p-5">
          <details>
            <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
              <Plus className="size-4 text-muted" /> 新增同步任务
            </summary>
            <form
              action={createSyncJob}
              className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className="text-[10px] text-muted">
                任务编码
                <input
                  name="code"
                  required
                  placeholder="SYNC-MES-WO"
                  className={`${inputClass} mt-1 font-mono`}
                />
              </label>
              <label className="text-[10px] text-muted">
                任务名称
                <input
                  name="name"
                  required
                  placeholder="MES 报修工单拉取"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted">
                集成端点
                <select name="endpointId" required className={`${inputClass} mt-1`}>
                  <option value="" disabled>
                    选择端点
                  </option>
                  {endpointRows.map((endpoint) => (
                    <option key={endpoint.id} value={endpoint.id}>
                      {endpoint.code} · {endpoint.name}
                      {endpoint.mock ? "（Mock）" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted">
                同步方向
                <select name="direction" className={`${inputClass} mt-1`}>
                  <option value="push">推送 · 本地 → 外部</option>
                  <option value="pull">拉取 · 外部 → 本地</option>
                </select>
              </label>
              <label className="text-[10px] text-muted">
                数据集
                <select name="dataset" className={`${inputClass} mt-1`}>
                  <optgroup label="推送支持">
                    {datasetsFor("push").map((key) => (
                      <option key={`push-${key}`} value={key}>
                        {SYNC_DATASET[key].label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="拉取支持">
                    {datasetsFor("pull").map((key) => (
                      <option key={`pull-${key}`} value={key}>
                        {SYNC_DATASET[key].label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label className="text-[10px] text-muted">
                建议间隔（分钟）
                <input
                  name="intervalMinutes"
                  type="number"
                  min={5}
                  defaultValue={30}
                  className={`${inputClass} mt-1 font-mono`}
                />
              </label>
              <label className="text-[10px] text-muted sm:col-span-2 lg:col-span-3">
                备注
                <input
                  name="note"
                  placeholder="选填：同步范围、责任人或切换计划"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <div className="flex items-end">
                <SubmitButton size="sm" className="h-9">
                  创建任务
                </SubmitButton>
              </div>
            </form>
          </details>
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">集成端点</h2>
            <Link
              href="/admin/integrations/endpoints"
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            >
              配置 <ArrowRight className="size-3" />
            </Link>
          </div>
          {endpointRows.length === 0 ? (
            <EmptyState
              icon={<Database className="size-8" />}
              title="还没有集成端点"
              hint="创建 MES / ERP / WMS 端点，默认使用 Mock 对端。"
              action={<LinkButton href="/admin/integrations/endpoints">新建端点</LinkButton>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {endpointRows.map((endpoint) => {
                const system = INTEGRATION_SYSTEM[endpoint.system];
                return (
                  <li key={endpoint.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-muted">
                        {endpoint.code}
                      </span>
                      <span className="text-[12px] font-medium">{endpoint.name}</span>
                      <Badge tone={system?.tone ?? "neutral"}>
                        {system?.short ?? endpoint.system}
                      </Badge>
                      <Badge tone={endpoint.mock ? "honey" : "ink"}>
                        {endpoint.mock ? "Mock" : "真实"}
                      </Badge>
                      <Badge tone={endpoint.enabled ? "mint" : "neutral"}>
                        {endpoint.enabled ? "启用" : "停用"}
                      </Badge>
                      {endpoint.mock && (
                        <span className="ml-auto text-[10px] text-muted">
                          待拉取 {pendingByEndpoint.get(endpoint.id) ?? 0}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted">
                      {endpoint.baseUrl}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">最近运行</h2>
            <Link
              href="/admin/integrations/runs"
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            >
              全部 <ArrowRight className="size-3" />
            </Link>
          </div>
          {runRows.length === 0 ? (
            <EmptyState
              icon={<ArrowsClockwise className="size-8" />}
              title="还没有运行记录"
              hint="点击任务上的“立即同步”开始第一次同步。"
            />
          ) : (
            <ul className="divide-y divide-line">
              {runRows.map(({ run, jobCode, jobName, endpointName }) => {
                const status = SYNC_RUN_STATUS[run.status];
                return (
                  <li key={run.id}>
                    <Link
                      href={`/admin/integrations/runs/${run.id}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-surface/60"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <span className="text-[12px] font-medium">{jobName}</span>
                        <span className="font-mono text-[10px] text-muted">
                          {jobCode}
                        </span>
                        <span className="ml-auto text-[10px] text-muted">
                          {fmtDateTime(run.startedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted">
                        {endpointName} · 共 {run.total} 条 · 成功 {run.applied} ·
                        跳过 {run.skipped} · 冲突 {run.conflict} · 失败 {run.failed}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4 p-5">
        <SectionTitle
          title="设备主数据开放接口"
          extra={<span className="label-mono">API · CRON</span>}
        />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold">
              <Database className="size-3.5 text-accent" /> 三方推送设备主数据
            </p>
            <p className="mt-2 font-mono text-[10px] text-ink-soft">
              POST /api/integrations/assets
            </p>
            <p className="mt-1 text-[10px] text-muted">
              Header：<span className="font-mono">x-api-key: &lt;集成端点令牌&gt;</span>，
              任一启用端点的令牌即可；也支持 Authorization Bearer。
              可选 <span className="font-mono">Idempotency-Key</span>，重试时回放首次结果（24 小时）。
              支持 <span className="font-mono">?mode=insert_only</span> 仅新建、跳过已存在设备。
            </p>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-ink p-3 font-mono text-[10px] leading-relaxed text-white/90">
{ASSET_PAYLOAD_EXAMPLE}
            </pre>
          </div>
          <div className="rounded-xl border border-line bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold">
              <ArrowsClockwise className="size-3.5 text-accent" /> 定时触发同步任务
            </p>
            <p className="mt-2 font-mono text-[10px] text-ink-soft">
              POST /api/integrations/cron
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Header：<span className="font-mono">x-cron-token: &lt;令牌&gt;</span>（不再支持 URL 传令牌）。
              调用一次即执行所有「已启用且到达建议间隔」的同步任务（推送与拉取），
              适合用系统 crontab 或外部调度每分钟/每 5 分钟调用。
              令牌取 <span className="font-mono">INTEGRATION_CRON_TOKEN</span>；
              未配置时回退校验任一启用端点令牌。并发调用只会有一个请求真正执行任务。
            </p>
            <ul className="mt-2 space-y-1 text-[10px] text-muted">
              <li>· 按设备编码 upsert：已存在则覆盖有值字段，不存在则建档并生成二维码</li>
              <li>· 空字段不会清空本地已维护的数据，二维码 token 与照片保持不变</li>
              <li>· 单次最多 500 条，返回 created / updated / errors 明细</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="card mt-4 p-5">
        <SectionTitle
          title="同步链路"
          extra={<span className="label-mono">IDEMPOTENT · RETRYABLE</span>}
        />
        <div className="flex flex-col gap-2 text-[12px] sm:flex-row sm:items-center">
          {[
            { title: "端点配置", hint: "Mock / 真实地址与令牌" },
            { title: "同步任务", hint: "方向 + 数据集 + 幂等键" },
            { title: "运行批次", hint: "逐条记录结果" },
            { title: "失败重试", hint: "保留原始运行，新建重试批次" },
            { title: "对账差异", hint: "冲突 / 失败人工闭环" },
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
          幂等键由“方向 + 数据集 + 端点 + 业务单号（推送含数据版本）”组成；重复执行不会重复建单或重复推送。
          拉取默认通过 Mock 报文验证，切换真实端点后按 GET /sync/&lt;dataset&gt;?status=pending 约定取数。
        </p>
      </section>
    </>
  );
}
