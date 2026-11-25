import { Plug, Plus, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { asc, count } from "drizzle-orm";

import { db } from "@/db";
import { integrationEndpoints, syncJobs } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { INTEGRATION_SYSTEM } from "@/lib/integration";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { createEndpoint, toggleEndpoint } from "@/server/integration-actions";

export const metadata = { title: "集成端点" };

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

function maskToken(token: string | null) {
  if (!token) return "—";
  if (token.length <= 4) return "••••";
  return `••••${token.slice(-4)}`;
}

export default async function IntegrationEndpointsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);

  const [endpoints, jobCounts] = await Promise.all([
    db
      .select()
      .from(integrationEndpoints)
      .orderBy(asc(integrationEndpoints.code)),
    db
      .select({ endpointId: syncJobs.endpointId, n: count() })
      .from(syncJobs)
      .groupBy(syncJobs.endpointId),
  ]);

  const jobsByEndpoint = new Map<string, number>();
  for (const row of jobCounts) {
    jobsByEndpoint.set(row.endpointId, Number(row.n));
  }

  return (
    <>
      <PageHeader
        eyebrow="Integration · endpoints"
        title="集成端点"
        description="维护 MES / ERP / WMS / IoT 对端地址、认证方式与 Mock 开关。Mock 端点把报文写入本地对端控制台，便于在无外部系统时完成联调与演示。"
        actions={
          <>
            <LinkButton href="/admin/integrations" variant="secondary">
              <Plug className="size-4" /> 返回集成中心
            </LinkButton>
            <LinkButton href="/admin/integrations/mock">Mock 对端</LinkButton>
          </>
        }
      />

      {sp.ok === "created" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          端点已创建，可继续新增同步任务。
        </p>
      )}
      {sp.ok === "toggled" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          端点状态已更新。
        </p>
      )}
      {sp.error === "fields" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          请填写端点编码、名称、系统类型与基础地址。
        </p>
      )}
      {sp.error === "duplicate" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          端点编码已存在，请换一个编码。
        </p>
      )}
      {sp.error === "forbidden" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          当前角色无端点配置权限。
        </p>
      )}

      {manageable && (
        <section className="card mb-4 p-5">
          <details open={endpoints.length === 0}>
            <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
              <Plus className="size-4 text-muted" /> 新增集成端点
            </summary>
            <form
              action={createEndpoint}
              className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className="text-[10px] text-muted">
                端点编码
                <input
                  name="code"
                  required
                  placeholder="MES-MOCK"
                  className={`${inputClass} mt-1 font-mono uppercase`}
                />
              </label>
              <label className="text-[10px] text-muted">
                端点名称
                <input
                  name="name"
                  required
                  placeholder="MES 生产系统（Mock）"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted">
                系统类型
                <select name="system" className={`${inputClass} mt-1`}>
                  {Object.entries(INTEGRATION_SYSTEM).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted lg:col-span-2">
                基础地址
                <input
                  name="baseUrl"
                  required
                  placeholder="http://mes.example.com/api"
                  className={`${inputClass} mt-1 font-mono`}
                />
              </label>
              <label className="text-[10px] text-muted">
                认证方式
                <select name="authType" className={`${inputClass} mt-1`}>
                  <option value="token">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="none">不认证（内网）</option>
                </select>
              </label>
              <label className="text-[10px] text-muted">
                令牌 / 凭据
                <input
                  name="token"
                  placeholder="Mock 端点可留空"
                  className={`${inputClass} mt-1 font-mono`}
                />
              </label>
              <label className="flex h-9 items-center gap-2 text-[11px] text-muted">
                <input type="checkbox" name="mock" value="1" defaultChecked />
                使用 Mock 对端（不发起真实请求）
              </label>
              <label className="flex h-9 items-center gap-2 text-[11px] text-muted">
                <input type="checkbox" name="enabled" value="1" defaultChecked />
                创建后立即启用
              </label>
              <label className="text-[10px] text-muted sm:col-span-2 lg:col-span-3">
                备注
                <input
                  name="note"
                  placeholder="选填：负责团队、网络区域、切换计划"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <div className="flex items-end">
                <SubmitButton size="sm" className="h-9">
                  保存端点
                </SubmitButton>
              </div>
            </form>
          </details>
        </section>
      )}

      {endpoints.length === 0 ? (
        <EmptyState
          icon={<Plug className="size-8" />}
          title="还没有集成端点"
          hint="先创建一个 Mock 端点，即可在无外部系统时跑通推送与拉取。"
        />
      ) : (
        <div className="space-y-3">
          {endpoints.map((endpoint) => {
            const system = INTEGRATION_SYSTEM[endpoint.system];
            return (
              <section key={endpoint.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-muted">
                        {endpoint.code}
                      </span>
                      <h2 className="text-[15px] font-semibold">{endpoint.name}</h2>
                      <Badge tone={system?.tone ?? "neutral"}>
                        {system?.label ?? endpoint.system}
                      </Badge>
                      <Badge tone={endpoint.mock ? "honey" : "ink"}>
                        {endpoint.mock ? "Mock 对端" : "真实接口"}
                      </Badge>
                      <Badge tone={endpoint.enabled ? "mint" : "neutral"}>
                        {endpoint.enabled ? "启用" : "停用"}
                      </Badge>
                    </div>
                    <p className="mt-1 break-all font-mono text-[11px] text-ink-soft">
                      {endpoint.baseUrl}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      认证 {endpoint.authType === "token" ? "Bearer" : endpoint.authType === "basic" ? "Basic" : "无"} ·
                      令牌 {maskToken(endpoint.token)} · 绑定任务{" "}
                      {jobsByEndpoint.get(endpoint.id) ?? 0} 个 · 创建于{" "}
                      {fmtDateTime(endpoint.createdAt)}
                    </p>
                    {endpoint.note && (
                      <p className="mt-1 text-[10px] text-muted">{endpoint.note}</p>
                    )}
                  </div>
                  {manageable && (
                    <form action={toggleEndpoint} className="shrink-0">
                      <input type="hidden" name="id" value={endpoint.id} />
                      <input
                        type="hidden"
                        name="enabled"
                        value={endpoint.enabled ? "0" : "1"}
                      />
                      <SubmitButton variant="secondary" size="sm" className="h-8">
                        {endpoint.enabled ? "停用端点" : "启用端点"}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section className="card mt-4 p-5">
        <SectionTitle
          title="真实接口约定"
          extra={
            <span className="label-mono inline-flex items-center gap-1">
              <ShieldCheck className="size-3" /> READY TO SWITCH
            </span>
          }
        />
        <p className="text-[11px] leading-relaxed text-muted">
          关闭 Mock 后，推送任务会向{" "}
          <code className="rounded bg-paper px-1 py-0.5 font-mono text-[10px]">
            POST &lt;baseUrl&gt;/sync/&lt;dataset&gt;
          </code>{" "}
          发送 JSON，请求头带{" "}
          <code className="rounded bg-paper px-1 py-0.5 font-mono text-[10px]">
            Authorization
          </code>
          ；拉取任务按{" "}
          <code className="rounded bg-paper px-1 py-0.5 font-mono text-[10px]">
            GET &lt;baseUrl&gt;/sync/&lt;dataset&gt;?status=pending
          </code>{" "}
          读取{" "}
          <code className="rounded bg-paper px-1 py-0.5 font-mono text-[10px]">
            {"{ items: [{ externalNo, payload }] }"}
          </code>
          。请求超时 8 秒，失败会记录在运行明细中，可一键重试。
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink px-4 py-3 text-[10px] leading-relaxed text-white/80">
{`# 拉取接口返回示例
{
  "items": [
    {
      "externalNo": "MES-WO-1001",
      "payload": {
        "assetCode": "EQ-0001",
        "title": "注塑机液压油温高",
        "priority": "high"
      }
    }
  ]
}`}
        </pre>
      </section>
    </>
  );
}
