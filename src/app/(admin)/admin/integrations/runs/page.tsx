import { ArrowRight, ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  integrationEndpoints,
  syncJobs,
  syncRuns,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  SYNC_DATASET,
  SYNC_DIRECTION,
  SYNC_RUN_STATUS,
  isIntegrationSystem,
} from "@/lib/integration";
import { fmtDateTime, timeAgo } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";

export const metadata = { title: "同步运行记录" };

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "success", label: "成功" },
  { key: "partial", label: "部分成功" },
  { key: "failed", label: "失败" },
  { key: "running", label: "同步中" },
];

export default async function SyncRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const selected = FILTERS.some((item) => item.key === sp.status)
    ? (sp.status ?? "all")
    : "all";
  const statusFilter =
    selected !== "all" &&
    ["success", "partial", "failed", "running"].includes(selected)
      ? (selected as "success" | "partial" | "failed" | "running")
      : null;

  const rows = await db
    .select({
      run: syncRuns,
      jobCode: syncJobs.code,
      jobName: syncJobs.name,
      endpointName: integrationEndpoints.name,
      endpointSystem: integrationEndpoints.system,
    })
    .from(syncRuns)
    .innerJoin(syncJobs, eq(syncRuns.jobId, syncJobs.id))
    .innerJoin(
      integrationEndpoints,
      eq(syncJobs.endpointId, integrationEndpoints.id),
    )
    .where(statusFilter ? eq(syncRuns.status, statusFilter) : undefined)
    .orderBy(desc(syncRuns.startedAt))
    .limit(100);

  return (
    <>
      <PageHeader
        eyebrow="Integration · runs"
        title="同步运行记录"
        description="每次执行都会生成独立批次，逐条记录创建、更新、幂等跳过、冲突与失败。原始批次保留，重试会新建一条重试批次。"
        actions={
          <>
            <LinkButton href="/admin/integrations" variant="secondary">
              <ArrowsClockwise className="size-4" /> 集成中心
            </LinkButton>
            <LinkButton href="/admin/integrations/reconcile">对账</LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={
              filter.key === "all"
                ? "/admin/integrations/runs"
                : `/admin/integrations/runs?status=${filter.key}`
            }
            className={
              selected === filter.key
                ? "rounded-full bg-ink px-3 py-1.5 text-[11px] text-white"
                : "rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-muted transition-colors hover:border-ink/30 hover:text-ink"
            }
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ArrowsClockwise className="size-8" />}
          title="没有符合条件的运行记录"
          hint="回到集成中心执行一次同步，或切换筛选条件。"
          action={<LinkButton href="/admin/integrations">返回集成中心</LinkButton>}
        />
      ) : (
        <section className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map(({ run, jobCode, jobName, endpointName, endpointSystem }) => {
              const status = SYNC_RUN_STATUS[run.status];
              const direction = SYNC_DIRECTION[run.direction];
              const dataset = SYNC_DATASET[run.dataset];
              const system = isIntegrationSystem(endpointSystem)
                ? endpointSystem
                : null;
              return (
                <li key={run.id}>
                  <Link
                    href={`/admin/integrations/runs/${run.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-surface/60"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <Badge tone={direction.tone}>{direction.label}</Badge>
                      <Badge tone="neutral">{dataset.label}</Badge>
                      <span className="text-[12px] font-medium">{jobName}</span>
                      <span className="font-mono text-[10px] text-muted">
                        {jobCode}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted">
                        {fmtDateTime(run.startedAt)} · {timeAgo(run.startedAt)}
                        <ArrowRight className="size-3" />
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted">
                      {endpointName}
                      {system ? ` · ${system.toUpperCase()}` : ""} ·{" "}
                      {run.trigger === "retry" ? "重试批次" : "手动执行"}
                      {run.actorName ? ` · ${run.actorName}` : ""} · 共 {run.total}{" "}
                      条 · 成功 {run.applied} · 跳过 {run.skipped} · 冲突{" "}
                      {run.conflict} · 失败 {run.failed}
                    </p>
                    {run.message && (
                      <p className="mt-0.5 truncate text-[10px] text-muted">
                        {run.message}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
