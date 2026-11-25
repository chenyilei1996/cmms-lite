import { ArrowRight, CheckCircle, Scales, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  integrationEndpoints,
  integrationMockMessages,
  syncJobs,
  syncRecords,
  syncRuns,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
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
  SectionTitle,
  StatCard,
} from "@/components/ui";

export const metadata = { title: "同步对账" };

export default async function IntegrationReconcilePage() {
  await requireUser();

  const [jobRows, latestRuns, pendingCounts, receivedCounts, problemRows] =
    await Promise.all([
      db
        .select({
          job: syncJobs,
          endpointCode: integrationEndpoints.code,
          endpointName: integrationEndpoints.name,
          endpointMock: integrationEndpoints.mock,
          endpointEnabled: integrationEndpoints.enabled,
        })
        .from(syncJobs)
        .innerJoin(
          integrationEndpoints,
          eq(syncJobs.endpointId, integrationEndpoints.id),
        )
        .orderBy(desc(syncJobs.enabled), syncJobs.code),
      db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(300),
      db
        .select({
          endpointId: integrationMockMessages.endpointId,
          dataset: integrationMockMessages.dataset,
          n: count(),
        })
        .from(integrationMockMessages)
        .where(eq(integrationMockMessages.status, "pending"))
        .groupBy(
          integrationMockMessages.endpointId,
          integrationMockMessages.dataset,
        ),
      db
        .select({
          endpointId: integrationMockMessages.endpointId,
          dataset: integrationMockMessages.dataset,
          n: count(),
        })
        .from(integrationMockMessages)
        .where(eq(integrationMockMessages.status, "received"))
        .groupBy(
          integrationMockMessages.endpointId,
          integrationMockMessages.dataset,
        ),
      db
        .select({
          record: syncRecords,
          jobCode: syncJobs.code,
          jobName: syncJobs.name,
        })
        .from(syncRecords)
        .innerJoin(syncJobs, eq(syncRecords.jobId, syncJobs.id))
        .where(inArray(syncRecords.status, ["conflict", "failed"]))
        .orderBy(desc(syncRecords.createdAt))
        .limit(30),
    ]);

  const latestByJob = new Map<string, typeof latestRuns>();
  for (const run of latestRuns) {
    const list = latestByJob.get(run.jobId) ?? [];
    if (list.length < 1) list.push(run);
    latestByJob.set(run.jobId, list);
  }

  const keyOf = (endpointId: string, dataset: string) => `${endpointId}:${dataset}`;
  const pendingMap = new Map(
    pendingCounts.map((row) => [
      keyOf(row.endpointId, row.dataset),
      Number(row.n),
    ]),
  );
  const receivedMap = new Map(
    receivedCounts.map((row) => [
      keyOf(row.endpointId, row.dataset),
      Number(row.n),
    ]),
  );

  const rows = jobRows.map((row) => {
    const latest = latestByJob.get(row.job.id)?.[0] ?? null;
    const pending = pendingMap.get(keyOf(row.job.endpointId, row.job.dataset)) ?? 0;
    const received =
      receivedMap.get(keyOf(row.job.endpointId, row.job.dataset)) ?? 0;
    const problem = latest ? latest.conflict + latest.failed : 0;
    return { ...row, latest, pending, received, problem };
  });

  const problemJobs = rows.filter((row) => row.problem > 0);
  const unresolved = rows.reduce((acc, row) => acc + row.problem, 0);
  const totalPending = rows.reduce((acc, row) => acc + row.pending, 0);

  return (
    <>
      <PageHeader
        eyebrow="Integration · reconciliation"
        title="同步对账"
        description="按任务核对最近批次结果与 Mock 对端报文：推送关注对端是否收到，拉取关注是否仍有待消费报文；冲突与失败逐条列在下方，可进入批次重试。"
        actions={
          <>
            <LinkButton href="/admin/integrations" variant="secondary">
              <Scales className="size-4" /> 集成中心
            </LinkButton>
            <LinkButton href="/admin/integrations/runs" variant="secondary">
              运行记录
            </LinkButton>
            <LinkButton href="/admin/integrations/mock">Mock 对端</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="对账任务"
          value={rows.length}
          tone="accent"
          icon={<Scales className="size-4" />}
          sub={`${rows.length - problemJobs.length} 个结论一致`}
        />
        <StatCard
          label="待处理差异"
          value={unresolved}
          tone={unresolved ? "danger" : "mint"}
          icon={<Warning className="size-4" />}
          sub="最近批次冲突 + 失败"
        />
        <StatCard
          label="待拉取报文"
          value={totalPending}
          tone="honey"
          sub="Mock 对端尚未被消费"
        />
        <StatCard
          label="核对时间"
          value={fmtDateTime(new Date())}
          tone="neutral"
          icon={<CheckCircle className="size-4" />}
          sub="页面实时读取最新批次"
        />
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">任务对账结论</h2>
          <p className="mt-0.5 text-[10px] text-muted">
            口径：推送核对最近批次成功 + 幂等跳过数量；拉取核对剩余待消费报文与批次冲突。
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Scales className="size-8" />}
            title="还没有同步任务"
            hint="创建任务并运行一次后，这里会展示对账结论。"
            action={<LinkButton href="/admin/integrations">返回集成中心</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ job, endpointCode, endpointName, endpointMock, latest, pending, received, problem }) => {
              const dataset = SYNC_DATASET[job.dataset];
              const direction = SYNC_DIRECTION[job.direction];
              const status = latest ? SYNC_RUN_STATUS[latest.status] : null;
              const consistent = latest ? problem === 0 : false;
              return (
                <li key={job.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-muted">
                          {job.code}
                        </span>
                        <span className="text-[12px] font-medium">{job.name}</span>
                        <Badge tone={direction.tone}>{direction.label}</Badge>
                        <Badge tone="neutral">{dataset.label}</Badge>
                        {!job.enabled && <Badge tone="neutral">任务停用</Badge>}
                        {status && <Badge tone={status.tone}>{status.label}</Badge>}
                      </div>
                      <p className="mt-1 text-[10px] text-muted">
                        {endpointCode} · {endpointName}
                        {endpointMock ? " · Mock" : " · 真实"}
                        {latest
                          ? ` · 最近批次 ${fmtDateTime(latest.startedAt)}`
                          : " · 尚未运行"}
                      </p>
                      {latest && (
                        <p className="mt-0.5 text-[10px] text-muted">
                          成功 {latest.applied} · 跳过 {latest.skipped} · 冲突{" "}
                          {latest.conflict} · 失败 {latest.failed}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <Badge tone={consistent ? "mint" : "danger"}>
                        {latest
                          ? consistent
                            ? "结论一致"
                            : `待处理 ${problem} 条`
                          : "未运行"}
                      </Badge>
                      <span className="text-[10px] text-muted">
                        {job.direction === "push"
                          ? `对端已接收 ${received} 条`
                          : `待拉取 ${pending} 条`}
                      </span>
                      {latest && (
                        <Link
                          href={`/admin/integrations/runs/${latest.id}`}
                          className="inline-flex items-center gap-1 text-[10px] text-accent-ink hover:underline"
                        >
                          查看批次 <ArrowRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionTitle
            title="待处理差异明细"
            extra={<span className="label-mono">CONFLICT / FAILED</span>}
            className="mb-0"
          />
          <p className="mt-1 text-[10px] text-muted">
            冲突多为本地缺少设备编码或外部单号重复；失败多为对端不可达或报文格式不符。补齐数据后可在批次页一键重试。
          </p>
        </div>
        {problemRows.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="size-8" />}
            title="没有冲突或失败记录"
            hint="所有同步批次均正常完成。"
          />
        ) : (
          <ul className="divide-y divide-line">
            {problemRows.map(({ record, jobCode, jobName }) => {
              const recordStatus = SYNC_RECORD_STATUS[record.status];
              return (
                <li key={record.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={recordStatus.tone}>{recordStatus.label}</Badge>
                    <span className="font-mono text-[10px] text-muted">
                      {record.externalNo ?? "—"}
                    </span>
                    <span className="text-[11px] text-muted">
                      {jobName}
                      <span className="ml-1 font-mono text-[9px]">{jobCode}</span>
                    </span>
                    <span className="ml-auto text-[10px] text-muted">
                      {fmtDateTime(record.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {record.message ?? "—"}
                  </p>
                  <Link
                    href={`/admin/integrations/runs/${record.runId}`}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent-ink hover:underline"
                  >
                    进入批次重试 <ArrowRight className="size-3" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
