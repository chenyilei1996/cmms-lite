import { ArrowCounterClockwise, ArrowLeft, ArrowsClockwise, CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  integrationEndpoints,
  syncJobs,
  syncRecords,
  syncRuns,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import {
  SYNC_DATASET,
  SYNC_DIRECTION,
  SYNC_RECORD_STATUS,
  SYNC_RUN_STATUS,
} from "@/lib/integration";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { retrySyncRun } from "@/server/integration-actions";

export const metadata = { title: "同步运行详情" };

export default async function SyncRunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);

  const [row] = await db
    .select({
      run: syncRuns,
      jobCode: syncJobs.code,
      jobName: syncJobs.name,
      jobId: syncJobs.id,
      endpointCode: integrationEndpoints.code,
      endpointName: integrationEndpoints.name,
      endpointMock: integrationEndpoints.mock,
    })
    .from(syncRuns)
    .innerJoin(syncJobs, eq(syncRuns.jobId, syncJobs.id))
    .innerJoin(
      integrationEndpoints,
      eq(syncJobs.endpointId, integrationEndpoints.id),
    )
    .where(eq(syncRuns.id, id))
    .limit(1);

  if (!row) notFound();

  const { run } = row;
  const records = await db
    .select()
    .from(syncRecords)
    .where(eq(syncRecords.runId, id))
    .orderBy(asc(syncRecords.createdAt), asc(syncRecords.attemptNo));

  const status = SYNC_RUN_STATUS[run.status];
  const direction = SYNC_DIRECTION[run.direction];
  const dataset = SYNC_DATASET[run.dataset];
  const canRetry = run.conflict + run.failed > 0 && manageable;

  return (
    <>
      <PageHeader
        eyebrow="Integration · run detail"
        title={`同步批次 ${run.id.slice(0, 8).toUpperCase()}`}
        description={`${row.jobName}（${row.jobCode}）于 ${fmtDateTime(
          run.startedAt,
        )} 由 ${run.actorName ?? "系统"} 触发，端点为 ${row.endpointCode} · ${
          row.endpointName
        }${row.endpointMock ? "（Mock）" : "（真实接口）"}。`}
        actions={
          <>
            <LinkButton href="/admin/integrations/runs" variant="secondary">
              <ArrowLeft className="size-4" /> 运行记录
            </LinkButton>
            <LinkButton href="/admin/integrations" variant="secondary">
              <ArrowsClockwise className="size-4" /> 集成中心
            </LinkButton>
            {canRetry && (
              <form action={retrySyncRun}>
                <input type="hidden" name="runId" value={run.id} />
                <SubmitButton>
                  <ArrowCounterClockwise className="size-4" /> 重试失败记录
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      {sp.ok === "retried" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          已生成重试批次。
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="成功写入"
          value={run.applied}
          tone="mint"
          icon={<CheckCircle className="size-4" />}
          sub={`共处理 ${run.total} 条`}
        />
        <StatCard
          label="幂等跳过"
          value={run.skipped}
          tone="neutral"
          sub="业务键已处理过"
        />
        <StatCard
          label="对账冲突"
          value={run.conflict}
          tone="honey"
          icon={<Warning className="size-4" />}
          sub="本地缺少关联数据"
        />
        <StatCard
          label="执行失败"
          value={run.failed}
          tone={run.failed ? "danger" : "neutral"}
          sub="对端异常或报文无效"
        />
      </div>

      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={direction.tone}>{direction.label}</Badge>
          <Badge tone="neutral">{dataset.label}</Badge>
          <Badge tone="neutral">
            {run.trigger === "retry" ? "重试批次" : "手动执行"}
          </Badge>
          <span className="font-mono text-[10px] text-muted">
            {row.jobCode} · {row.endpointCode}
          </span>
          <span className="ml-auto text-[10px] text-muted">
            {fmtDateTime(run.startedAt)}
            {run.finishedAt ? ` → ${fmtDateTime(run.finishedAt)}` : " · 进行中"}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
          {run.message ?? "—"}
        </p>
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[13px] font-semibold">逐条同步明细</h2>
            <p className="mt-0.5 text-[10px] text-muted">
              幂等键 + 尝试次数唯一；重试不会覆盖原始结果
            </p>
          </div>
          <span className="label-mono">{records.length} RECORDS</span>
        </div>
        {records.length === 0 ? (
          <EmptyState
            icon={<ArrowsClockwise className="size-8" />}
            title="本次运行没有明细"
            hint={
              direction.label === "拉取"
                ? "对端没有待拉取报文，注入 Mock 报文后再试。"
                : "本地没有符合条件的数据。"
            }
            action={<LinkButton href="/admin/integrations/mock">Mock 对端</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {records.map((record) => {
              const recordStatus = SYNC_RECORD_STATUS[record.status];
              return (
                <li key={record.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={recordStatus.tone}>{recordStatus.label}</Badge>
                    <span className="font-mono text-[10px] text-muted">
                      {record.externalNo ?? "—"}
                    </span>
                    {record.localEntity && (
                      <span className="text-[10px] text-muted">
                        {record.localEntity}
                        {record.localCode ? ` · ${record.localCode}` : ""}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-muted">
                      第 {record.attemptNo} 次
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {record.message ?? "—"}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[9px] text-muted">
                    key: {record.idempotencyKey}
                  </p>
                  {record.payload && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[10px] text-muted hover:text-ink">
                        查看报文
                      </summary>
                      <pre className="mt-1.5 overflow-x-auto rounded-lg bg-paper px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-soft">
{JSON.stringify(record.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        需要查看其它批次？回到{" "}
        <Link href="/admin/integrations/runs" className="text-accent-ink hover:underline">
          运行记录
        </Link>{" "}
        或到{" "}
        <Link
          href="/admin/integrations/reconcile"
          className="text-accent-ink hover:underline"
        >
          对账
        </Link>{" "}
        查看尚未闭环的冲突与失败。
      </p>
    </>
  );
}
