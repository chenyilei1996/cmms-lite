import { ClipboardText, Clock, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, asc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  downtimeRecords,
  users,
  workOrderEvents,
  workOrders,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { PRIORITY, WO_STATUS, WO_TYPE } from "@/lib/constants";
import {
  DataCutoff,
  ExportLink,
  ReportFilters,
  ReportNote,
  ReportTabs,
} from "@/components/report-chrome";
import { Badge, Bar, PageHeader, StatCard } from "@/components/ui";
import {
  fmtMinutes,
  fmtPercent,
  periodRange,
  resolveDays,
} from "@/lib/reporting";

export const metadata = { title: "工单分析" };

const OPEN_STATUS = ["new", "assigned", "in_progress", "pending_acceptance"];
const CLOSED_STATUS = ["completed", "closed"];

export default async function WorkOrderAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    type?: string;
    priority?: string;
    assignee?: string;
    asset?: string;
  }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const days = resolveDays(sp.days);
  const now = new Date();
  const { since } = periodRange(days, now);

  const [woRows, eventRows, downtimeRows, userRows, assetRows] =
    await Promise.all([
      db.select().from(workOrders),
      db
        .select({
          workOrderId: workOrderEvents.workOrderId,
          toStatus: workOrderEvents.toStatus,
          createdAt: workOrderEvents.createdAt,
        })
        .from(workOrderEvents),
      db
        .select({
          workOrderId: downtimeRecords.workOrderId,
          minutes: downtimeRecords.minutes,
          type: downtimeRecords.type,
          startedAt: downtimeRecords.startedAt,
        })
        .from(downtimeRecords),
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .orderBy(asc(users.name)),
      db
        .select({ id: assets.id, code: assets.code, name: assets.name })
        .from(assets)
        .where(
          and(
            inArray(assets.level, ["machine", "component"]),
            ne(assets.status, "retired"),
          ),
        )
        .orderBy(asc(assets.code)),
    ]);

  const userMap = new Map(userRows.map((row) => [row.id, row.name]));
  const assetMap = new Map(assetRows.map((row) => [row.id, row]));

  const filtered = woRows.filter((wo) => {
    if (sp.type && wo.type !== sp.type) return false;
    if (sp.priority && wo.priority !== sp.priority) return false;
    if (sp.assignee && wo.assigneeId !== sp.assignee) return false;
    if (sp.asset && wo.assetId !== sp.asset) return false;
    return true;
  });

  const periodRows = filtered.filter(
    (wo) =>
      wo.createdAt >= since ||
      (wo.completedAt !== null && wo.completedAt >= since) ||
      (wo.closedAt !== null && wo.closedAt >= since),
  );
  const periodIds = new Set(periodRows.map((wo) => wo.id));

  const closedRows = periodRows.filter((wo) =>
    CLOSED_STATUS.includes(wo.status),
  );
  const timelyRows = closedRows.filter(
    (wo) => wo.dueAt && (wo.closedAt ?? wo.completedAt)! <= wo.dueAt,
  );

  const firstResponse = new Map<string, Date>();
  for (const event of eventRows) {
    if (!periodIds.has(event.workOrderId)) continue;
    if (!["assigned", "in_progress"].includes(event.toStatus)) continue;
    const current = firstResponse.get(event.workOrderId);
    if (!current || event.createdAt < current) {
      firstResponse.set(event.workOrderId, event.createdAt);
    }
  }
  const responseMinutes: number[] = [];
  for (const wo of periodRows) {
    const respondedAt = firstResponse.get(wo.id);
    if (!respondedAt) continue;
    const minutes = (respondedAt.getTime() - wo.createdAt.getTime()) / 60000;
    if (minutes >= 0) responseMinutes.push(minutes);
  }
  const avgResponse = responseMinutes.length
    ? responseMinutes.reduce((sum, value) => sum + value, 0) /
      responseMinutes.length
    : null;

  const repairMinutes: number[] = [];
  for (const row of downtimeRows) {
    if (row.type !== "unplanned" || !row.workOrderId) continue;
    if (!periodIds.has(row.workOrderId)) continue;
    if (row.startedAt < since) continue;
    repairMinutes.push(row.minutes);
  }
  const avgRepair = repairMinutes.length
    ? repairMinutes.reduce((sum, value) => sum + value, 0) /
      repairMinutes.length
    : null;

  const backlogRows = filtered.filter((wo) => OPEN_STATUS.includes(wo.status));
  const overdueRows = backlogRows.filter(
    (wo) => wo.dueAt !== null && wo.dueAt < now,
  );

  const typeDist = Object.keys(WO_TYPE).map((key) => ({
    key,
    label: WO_TYPE[key].label,
    value: periodRows.filter((wo) => wo.type === key).length,
  }));
  const priorityDist = Object.keys(PRIORITY).map((key) => ({
    key,
    label: PRIORITY[key].label,
    value: periodRows.filter((wo) => wo.priority === key).length,
  }));
  const assigneeDist = [...userRows]
    .map((user) => ({
      key: user.id,
      label: user.name,
      value: periodRows.filter((wo) => wo.assigneeId === user.id).length,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const exceptionRows = filtered
    .filter((wo) => {
      const finishedAt = wo.closedAt ?? wo.completedAt;
      if (finishedAt && wo.dueAt) return finishedAt > wo.dueAt;
      return (
        !finishedAt &&
        wo.dueAt !== null &&
        wo.dueAt < now &&
        OPEN_STATUS.includes(wo.status)
      );
    })
    .sort((a, b) => {
      const aEnd = (a.closedAt ?? a.completedAt ?? now).getTime();
      const bEnd = (b.closedAt ?? b.completedAt ?? now).getTime();
      return bEnd - b.dueAt!.getTime() - (aEnd - a.dueAt!.getTime());
    })
    .slice(0, 12);

  return (
    <>
      <PageHeader
        eyebrow="Reports · work orders"
        title="工单分析"
        description="及时率、响应与修复时长、积压与超期明细。所有指标都从工单与事件时间线复算。"
        actions={
          <ExportLink
            report="work-orders"
            days={days}
            filters={{
              type: sp.type,
              priority: sp.priority,
              assignee: sp.assignee,
              asset: sp.asset,
            }}
          />
        }
      />
      <ReportTabs active="/admin/analytics/work-orders" />
      <ReportFilters
        basePath="/admin/analytics/work-orders"
        days={days}
        selects={[
          {
            name: "asset",
            label: "设备",
            value: sp.asset,
            allLabel: "全部设备",
            options: assetRows.map((row) => ({
              value: row.id,
              label: `${row.code} · ${row.name}`,
            })),
          },
          {
            name: "type",
            label: "工单类型",
            value: sp.type,
            allLabel: "全部类型",
            options: Object.entries(WO_TYPE).map(([value, meta]) => ({
              value,
              label: meta.label,
            })),
          },
          {
            name: "priority",
            label: "优先级",
            value: sp.priority,
            allLabel: "全部优先级",
            options: Object.entries(PRIORITY).map(([value, meta]) => ({
              value,
              label: meta.label,
            })),
          },
          {
            name: "assignee",
            label: "负责人",
            value: sp.assignee,
            allLabel: "全部人员",
            options: userRows.map((row) => ({
              value: row.id,
              label: row.name,
            })),
          },
        ]}
      />
      <DataCutoff
        now={now}
        days={days}
        extra={`统计期工单 ${periodRows.length} 张 · 当前积压 ${backlogRows.length} 张`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="已关闭工单"
          value={closedRows.length}
          tone="mint"
          icon={<ClipboardText className="size-4" />}
          sub={`统计期共 ${periodRows.length} 张`}
        />
        <StatCard
          label="工单及时率"
          value={fmtPercent(timelyRows.length, closedRows.length)}
          tone="accent"
          icon={<Clock className="size-4" />}
          sub={`${timelyRows.length}/${closedRows.length} 在期望时间内`}
        />
        <StatCard
          label="平均响应时长"
          value={avgResponse === null ? "—" : fmtMinutes(avgResponse)}
          tone="honey"
          icon={<Clock className="size-4" />}
          sub={`${responseMinutes.length} 张有派工/开工记录`}
        />
        <StatCard
          label="平均修复时长"
          value={avgRepair === null ? "—" : fmtMinutes(avgRepair)}
          tone="neutral"
          icon={<Clock className="size-4" />}
          sub={`${repairMinutes.length} 条非计划停机`}
        />
        <StatCard
          label="当前积压"
          value={backlogRows.length}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub="新建 / 派工 / 处理中 / 待验收"
        />
        <StatCard
          label="超期未完成"
          value={overdueRows.length}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub="已过期望完成时间"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {[
          { title: "按类型", rows: typeDist },
          { title: "按优先级", rows: priorityDist },
          { title: "按负责人", rows: assigneeDist },
        ].map((section) => {
          const max = Math.max(...section.rows.map((row) => row.value), 1);
          return (
            <section key={section.title} className="card p-5">
              <h2 className="mb-3 text-[13px] font-semibold">{section.title}</h2>
              {section.rows.length === 0 ? (
                <p className="text-[12px] text-muted">暂无数据。</p>
              ) : (
                <div className="space-y-3">
                  {section.rows.map((row) => (
                    <div key={row.key}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="text-ink-soft">{row.label}</span>
                        <span className="font-mono text-muted">{row.value}</span>
                      </div>
                      <Bar value={row.value} total={max} tone="accent" />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold">超期与延期明细</h2>
          <span className="label-mono">{exceptionRows.length} ITEMS</span>
        </div>
        {exceptionRows.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-muted">
            当前筛选下没有超期或延期工单。
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {exceptionRows.map((wo) => {
              const finishedAt = wo.closedAt ?? wo.completedAt;
              const lateMinutes = wo.dueAt
                ? Math.round(
                    ((finishedAt ?? now).getTime() - wo.dueAt.getTime()) / 60000,
                  )
                : 0;
              const meta = WO_STATUS[wo.status];
              return (
                <li key={wo.id}>
                  <Link
                    href={`/app/work-orders/${wo.id}`}
                    className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-paper/60 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium">
                        {wo.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                        {wo.code} ·{" "}
                        {assetMap.get(wo.assetId)?.name ?? "未知设备"} ·{" "}
                        {userMap.get(wo.assigneeId ?? "") ?? "待派工"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="font-mono text-[11px] text-danger">
                        {finishedAt ? "延期" : "超期"} {fmtMinutes(lateMinutes)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ReportNote>
        响应时长取首次派工或开工事件减去工单创建时间；修复时长取统计期内非计划停机记录；及时率分母为统计期内关闭的工单，取消工单不计。当前无 SLA 字段，超期以期望完成时间判定。
      </ReportNote>
    </>
  );
}
