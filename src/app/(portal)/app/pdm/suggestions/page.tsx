import { ArrowRight, ClipboardText, Gauge, ListChecks, Wrench, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  pdmSuggestedWorkOrders,
  users,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { PRIORITY } from "@/lib/constants";
import { PDM_SUGGESTION_STATUS } from "@/lib/pdm";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";
import {
  convertSuggestion,
  dismissSuggestion,
} from "@/server/pdm-actions";

export const metadata = { title: "预测建议工单" };

const FILTERS = [
  { key: "pending", label: "待确认" },
  { key: "all", label: "全部" },
  { key: "converted", label: "已转工单" },
  { key: "dismissed", label: "已驳回" },
];

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

function defaultDue() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default async function PdmSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const repairable = canRepair(user.role);
  const manageable = canManage(user.role);
  const filter = FILTERS.some((item) => item.key === sp.status)
    ? sp.status!
    : "pending";

  const where =
    filter === "all"
      ? undefined
      : eq(
          pdmSuggestedWorkOrders.status,
          filter as "pending" | "converted" | "dismissed",
        );

  const [suggestionRows, allRows, technicianRows] = await Promise.all([
    db
      .select({
        suggestion: pdmSuggestedWorkOrders,
        assetCode: assets.code,
        assetName: assets.name,
        workOrderCode: workOrders.code,
        createdByName: users.name,
      })
      .from(pdmSuggestedWorkOrders)
      .innerJoin(assets, eq(pdmSuggestedWorkOrders.assetId, assets.id))
      .leftJoin(
        workOrders,
        eq(pdmSuggestedWorkOrders.convertedWorkOrderId, workOrders.id),
      )
      .leftJoin(users, eq(pdmSuggestedWorkOrders.createdById, users.id))
      .where(where)
      .orderBy(desc(pdmSuggestedWorkOrders.createdAt))
      .limit(120),
    db
      .select({ status: pdmSuggestedWorkOrders.status })
      .from(pdmSuggestedWorkOrders),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(
        and(
          eq(users.active, true),
          inArray(users.role, ["admin", "manager", "technician"]),
        ),
      )
      .orderBy(desc(users.role)),
  ]);

  const pending = allRows.filter((row) => row.status === "pending").length;
  const converted = allRows.filter((row) => row.status === "converted").length;
  const dismissed = allRows.filter((row) => row.status === "dismissed").length;
  const due = defaultDue();

  return (
    <>
      <PageHeader
        eyebrow="Predictive · suggested work orders"
        title="预测建议工单"
        description="报警转成的建议工单必须由人工确认后，才会生成正式纠正性维修工单。可指定负责人、截止日期与优先级；不确认则不会派工，也不会停机。"
        actions={
          <>
            <LinkButton href="/app/pdm" variant="secondary">
              <Gauge className="size-4" /> 预测总览
            </LinkButton>
            <LinkButton href="/app/pdm/alarms" variant="secondary">
              报警
            </LinkButton>
            {manageable && (
              <LinkButton href="/admin/pdm/sensors" variant="secondary">
                测点与规则
              </LinkButton>
            )}
          </>
        }
      />

      {sp.ok === "created" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          建议工单已生成，确认后会转为正式工单。
        </p>
      )}
      {sp.ok === "dismiss" && (
        <p className="mb-4 rounded-xl bg-paper px-4 py-3 text-[12px] text-muted">
          建议工单已驳回。
        </p>
      )}
      {sp.error === "exists" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          该报警已有待确认建议，请直接处理现有建议。
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="待确认"
          value={pending}
          tone="honey"
          icon={<ListChecks className="size-4" />}
          sub="需人工决定是否转单"
        />
        <StatCard
          label="已转工单"
          value={converted}
          tone="mint"
          icon={<Wrench className="size-4" />}
          sub="进入维修工单流程"
        />
        <StatCard
          label="已驳回"
          value={dismissed}
          tone="neutral"
          sub="人工判断无需处理"
        />
        <StatCard
          label="建议总数"
          value={allRows.length}
          tone="accent"
          icon={<ClipboardText className="size-4" />}
          sub="报警 → 建议 → 工单"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/app/pdm/suggestions?status=${item.key}`}
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
          展示 {suggestionRows.length} 条
        </span>
      </div>

      {suggestionRows.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-8" />}
          title="没有符合条件的建议工单"
          hint="在报警页对未关闭报警点击“生成建议工单”即可创建。"
          action={<LinkButton href="/app/pdm/alarms">去处理报警</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {suggestionRows.map((row) => {
            const status =
              PDM_SUGGESTION_STATUS[row.suggestion.status] ??
              PDM_SUGGESTION_STATUS.pending;
            const priority =
              PRIORITY[row.suggestion.priority] ?? PRIORITY.medium;
            return (
              <section key={row.suggestion.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-muted">
                        {row.suggestion.code}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <Badge tone={priority.tone}>{priority.label}优先级</Badge>
                      <span className="text-[10px] text-muted">
                        {fmtDateTime(row.suggestion.createdAt)}
                        {row.createdByName ? ` · ${row.createdByName}` : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] font-semibold">
                      {row.suggestion.title}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {row.assetCode} · {row.assetName}
                    </p>
                  </div>
                  {row.suggestion.convertedWorkOrderId && (
                    <Link
                      href={`/app/work-orders/${row.suggestion.convertedWorkOrderId}`}
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-mint-soft px-3 text-[11px] text-mint hover:opacity-80"
                    >
                      {row.workOrderCode ?? "查看工单"}
                      <ArrowRight className="size-3" />
                    </Link>
                  )}
                </div>

                {row.suggestion.description && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] text-muted hover:text-ink">
                      查看报警依据
                    </summary>
                    <pre className="mt-1.5 whitespace-pre-wrap rounded-xl bg-paper px-3 py-2 text-[10px] leading-relaxed text-ink-soft">
                      {row.suggestion.description}
                    </pre>
                  </details>
                )}

                {row.suggestion.status === "pending" && repairable && (
                  <div className="mt-3 border-t border-line pt-3">
                    <form
                      action={convertSuggestion}
                      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={row.suggestion.id}
                      />
                      <label className="text-[10px] text-muted">
                        负责人
                        <select
                          name="assigneeId"
                          className={`${inputClass} mt-1`}
                        >
                          <option value="">暂不指派</option>
                          {technicianRows.map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] text-muted">
                        截止日期
                        <input
                          name="dueAt"
                          type="date"
                          defaultValue={due}
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                      <label className="text-[10px] text-muted">
                        优先级
                        <select
                          name="priority"
                          defaultValue={row.suggestion.priority}
                          className={`${inputClass} mt-1`}
                        >
                          {Object.entries(PRIORITY).map(([key, meta]) => (
                            <option key={key} value={key}>
                              {meta.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-end">
                        <SubmitButton size="sm" className="h-9 w-full">
                          确认转正式工单
                        </SubmitButton>
                      </div>
                      <label className="text-[10px] text-muted sm:col-span-2 lg:col-span-3">
                        备注
                        <input
                          name="note"
                          placeholder="确认说明（选填）"
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                    </form>
                    <form action={dismissSuggestion} className="mt-2">
                      <input
                        type="hidden"
                        name="id"
                        value={row.suggestion.id}
                      />
                      <ConfirmSubmitButton
                        message="驳回后该建议不会生成工单，确认驳回？"
                        className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-danger"
                      >
                        <X className="size-3" /> 驳回建议
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                )}

                {row.suggestion.handledAt && row.suggestion.status !== "pending" && (
                  <p className="mt-2 text-[10px] text-muted">
                    处理时间 {fmtDateTime(row.suggestion.handledAt)}
                    {row.suggestion.note ? ` · ${row.suggestion.note}` : ""}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
