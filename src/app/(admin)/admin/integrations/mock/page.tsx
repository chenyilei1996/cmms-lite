import { CloudArrowUp, PaperPlaneTilt, Tray } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  integrationEndpoints,
  integrationMockMessages,
  syncJobs,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { ASSET_STATUS } from "@/lib/constants";
import {
  INTEGRATION_SYSTEM,
  MOCK_MESSAGE_STATUS,
  SYNC_DATASET,
} from "@/lib/integration";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import {
  injectMockMessage,
  runSyncJob,
} from "@/server/integration-actions";

export const metadata = { title: "Mock 对端" };

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

export default async function IntegrationMockPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);

  const [endpointRows, messageRows, pullJobs] = await Promise.all([
    db
      .select()
      .from(integrationEndpoints)
      .where(eq(integrationEndpoints.mock, true))
      .orderBy(asc(integrationEndpoints.code)),
    db
      .select({
        message: integrationMockMessages,
        endpointCode: integrationEndpoints.code,
        endpointName: integrationEndpoints.name,
        endpointSystem: integrationEndpoints.system,
      })
      .from(integrationMockMessages)
      .innerJoin(
        integrationEndpoints,
        eq(integrationMockMessages.endpointId, integrationEndpoints.id),
      )
      .orderBy(desc(integrationMockMessages.createdAt))
      .limit(60),
    db
      .select({
        job: syncJobs,
        endpointName: integrationEndpoints.name,
        endpointCode: integrationEndpoints.code,
      })
      .from(syncJobs)
      .innerJoin(
        integrationEndpoints,
        eq(syncJobs.endpointId, integrationEndpoints.id),
      )
      .where(eq(syncJobs.direction, "pull"))
      .orderBy(asc(syncJobs.code)),
  ]);

  const pendingMessages = messageRows.filter(
    (row) => row.message.status === "pending",
  );
  const mockEndpoints = endpointRows.filter((row) => row.enabled);

  return (
    <>
      <PageHeader
        eyebrow="Integration · mock peer"
        title="Mock 对端"
        description="在外部 MES / ERP 尚未联调前，用本地 Mock 对端模拟双向报文：注入待拉取工单或设备主数据，执行拉取任务后真实落库；推送任务写入的报文也会在此留存，便于核对字段。"
        actions={
          <>
            <LinkButton href="/admin/integrations" variant="secondary">
              <Tray className="size-4" /> 集成中心
            </LinkButton>
            <LinkButton href="/admin/integrations/runs" variant="secondary">
              运行记录
            </LinkButton>
            <LinkButton href="/admin/integrations/reconcile">对账</LinkButton>
          </>
        }
      />

      {sp.ok === "injected" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          模拟报文已注入，点击对应拉取任务的“立即拉取”即可消费。
        </p>
      )}
      {sp.error === "fields" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          请选择端点、数据集并填写必填字段。
        </p>
      )}
      {sp.error === "external" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          请填写外部单号，作为幂等键的一部分。
        </p>
      )}
      {sp.error === "endpoint" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          端点不存在，请重新选择。
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <section className="card p-4">
          <p className="label-mono">待拉取报文</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums">
            {pendingMessages.length}
          </p>
          <p className="mt-2 text-[10px] text-muted">
            外部已就绪，等待拉取任务消费
          </p>
        </section>
        <section className="card p-4">
          <p className="label-mono">Mock 端点</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums">
            {mockEndpoints.length}
          </p>
          <p className="mt-2 text-[10px] text-muted">
            共 {endpointRows.length} 个 Mock 端点，{mockEndpoints.length} 个启用
          </p>
        </section>
        <section className="card p-4">
          <p className="label-mono">报文总量</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums">
            {messageRows.length}
          </p>
          <p className="mt-2 text-[10px] text-muted">
            含待拉取、已消费与已接收报文
          </p>
        </section>
      </div>

      {pullJobs.length > 0 && (
        <section className="card mb-4 p-5">
          <SectionTitle
            title="拉取任务快捷执行"
            extra={<span className="label-mono">PULL JOBS</span>}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {pullJobs.map(({ job, endpointCode }) => {
              const dataset = SYNC_DATASET[job.dataset];
              const pending = pendingMessages.filter(
                (row) => row.message.dataset === job.dataset,
              ).length;
              return (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper/50 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{job.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted">
                      {endpointCode} · {dataset.label} · 待拉取 {pending} 条
                      {job.enabled ? "" : " · 任务已停用"}
                    </p>
                  </div>
                  {manageable && (
                    <form action={runSyncJob}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <SubmitButton
                        size="sm"
                        className="h-8"
                        disabled={!job.enabled}
                      >
                        <CloudArrowUp className="size-3.5" /> 立即拉取
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {manageable && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <SectionTitle
              title="注入外部报修工单"
              extra={<span className="label-mono">→ WORK ORDER</span>}
            />
            {mockEndpoints.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-4 text-[11px] text-muted">
                还没有启用的 Mock 端点，请先到端点配置创建。
              </p>
            ) : (
              <form action={injectMockMessage} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="dataset" value="work_order" />
                <label className="text-[10px] text-muted">
                  Mock 端点
                  <select name="endpointId" required className={`${inputClass} mt-1`}>
                    <option value="" disabled>
                      选择端点
                    </option>
                    {mockEndpoints.map((endpoint) => (
                      <option key={endpoint.id} value={endpoint.id}>
                        {endpoint.code} · {endpoint.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-muted">
                  外部单号
                  <input
                    name="externalNo"
                    required
                    placeholder="MES-WO-1001"
                    className={`${inputClass} mt-1 font-mono`}
                  />
                </label>
                <label className="text-[10px] text-muted">
                  设备编码
                  <input
                    name="assetCode"
                    required
                    placeholder="EQ-0001"
                    className={`${inputClass} mt-1 font-mono uppercase`}
                  />
                </label>
                <label className="text-[10px] text-muted">
                  优先级
                  <select name="priority" className={`${inputClass} mt-1`}>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </label>
                <label className="text-[10px] text-muted sm:col-span-2">
                  工单标题
                  <input
                    name="title"
                    placeholder="注塑机液压油温偏高"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="text-[10px] text-muted sm:col-span-2">
                  故障描述
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="MES 安灯触发：油温连续 10 分钟超过 55℃"
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] focus:border-ink/30 focus:outline-none"
                  />
                </label>
                <label className="text-[10px] text-muted sm:col-span-2">
                  备注
                  <input
                    name="note"
                    placeholder="选填：报文来源说明"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <div className="sm:col-span-2">
                  <SubmitButton size="sm" className="h-9">
                    <PaperPlaneTilt className="size-3.5" /> 注入待拉取报文
                  </SubmitButton>
                </div>
              </form>
            )}
          </section>

          <section className="card p-5">
            <SectionTitle
              title="注入设备主数据变更"
              extra={<span className="label-mono">→ ASSET MASTER</span>}
            />
            {mockEndpoints.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-4 text-[11px] text-muted">
                还没有启用的 Mock 端点，请先到端点配置创建。
              </p>
            ) : (
              <form action={injectMockMessage} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="dataset" value="asset_master" />
                <label className="text-[10px] text-muted">
                  Mock 端点
                  <select name="endpointId" required className={`${inputClass} mt-1`}>
                    <option value="" disabled>
                      选择端点
                    </option>
                    {mockEndpoints.map((endpoint) => (
                      <option key={endpoint.id} value={endpoint.id}>
                        {endpoint.code} · {endpoint.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-muted">
                  外部单号
                  <input
                    name="externalNo"
                    required
                    placeholder="ERP-AST-0003"
                    className={`${inputClass} mt-1 font-mono`}
                  />
                </label>
                <label className="text-[10px] text-muted">
                  设备编码
                  <input
                    name="assetCode"
                    required
                    placeholder="EQ-0003"
                    className={`${inputClass} mt-1 font-mono uppercase`}
                  />
                </label>
                <label className="text-[10px] text-muted">
                  设备名称
                  <input
                    name="title"
                    placeholder="数控车床"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="text-[10px] text-muted">
                  设备类别
                  <input
                    name="category"
                    placeholder="机加工设备"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="text-[10px] text-muted">
                  制造商
                  <input
                    name="manufacturer"
                    placeholder="沈阳机床"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="text-[10px] text-muted">
                  设备状态
                  <select name="status" className={`${inputClass} mt-1`}>
                    {Object.entries(ASSET_STATUS).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-muted">
                  关键度
                  <select name="criticality" className={`${inputClass} mt-1`}>
                    <option value="A">A 关键</option>
                    <option value="B">B 重要</option>
                    <option value="C">C 一般</option>
                  </select>
                </label>
                <label className="text-[10px] text-muted sm:col-span-2">
                  备注
                  <input
                    name="note"
                    placeholder="选填：报文来源说明"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <div className="sm:col-span-2">
                  <SubmitButton size="sm" variant="secondary" className="h-9">
                    <PaperPlaneTilt className="size-3.5" /> 注入待拉取报文
                  </SubmitButton>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[13px] font-semibold">Mock 报文流水</h2>
            <p className="mt-0.5 text-[10px] text-muted">
              待拉取 = 外部待本地消费；已消费 = 拉取成功；已接收 = 本地推送到 Mock
            </p>
          </div>
          <span className="label-mono">LATEST 60</span>
        </div>
        {messageRows.length === 0 ? (
          <EmptyState
            icon={<Tray className="size-8" />}
            title="还没有 Mock 报文"
            hint="用上方表单注入一条外部工单或设备主数据，体验拉取链路。"
          />
        ) : (
          <ul className="divide-y divide-line">
            {messageRows.map(({ message, endpointCode, endpointName, endpointSystem }) => {
              const status = MOCK_MESSAGE_STATUS[message.status];
              const system = INTEGRATION_SYSTEM[endpointSystem];
              const dataset = SYNC_DATASET[message.dataset];
              return (
                <li key={message.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-muted">
                      {message.externalNo}
                    </span>
                    <span className="text-[12px] font-medium">
                      {dataset.label}
                    </span>
                    <Badge tone={status?.tone ?? "neutral"}>
                      {status?.label ?? message.status}
                    </Badge>
                    <Badge tone={system?.tone ?? "neutral"}>
                      {system?.short ?? endpointSystem}
                    </Badge>
                    <span className="text-[10px] text-muted">
                      {endpointCode} · {endpointName}
                    </span>
                    <span className="ml-auto text-[10px] text-muted">
                      {fmtDateTime(message.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    {status?.hint ?? ""}
                    {message.note ? ` · ${message.note}` : ""}
                  </p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[10px] text-muted hover:text-ink">
                      查看报文
                    </summary>
                    <pre className="mt-1.5 overflow-x-auto rounded-lg bg-paper px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-soft">
{JSON.stringify(message.payload ?? {}, null, 2)}
                    </pre>
                  </details>
                  {message.consumedRunId && (
                    <Link
                      href={`/admin/integrations/runs/${message.consumedRunId}`}
                      className="mt-1 inline-block text-[10px] text-accent-ink hover:underline"
                    >
                      查看消费该报文的运行 →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
