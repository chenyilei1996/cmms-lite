import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "审计日志" };

const ACTION_LABEL: Record<string, string> = {
  "asset.create": "设备建档",
  "asset.move": "层级移动",
  "asset.status": "状态变更",
  "asset.profile": "档案更新",
  "asset.document": "上传文档",
  "asset.document.delete": "删除文档",
  "work_order.create": "创建工单",
  "work_order.assign": "派工",
  "work_order.transfer": "转派",
  "work_order.start": "开工",
  "work_order.sign": "电子签名",
  "work_order.fault": "故障分析",
  "work_order.accept": "验收",
  "work_order.close": "关闭",
  "work_order.reopen": "退回返修",
  "work_order.cancel": "取消工单",
  "work_order.move": "看板流转",
  "work_order.pm_auto": "PM 自动建单",
  "work_order.from_inspection": "点检异常转单",
  "work_order.from_task": "巡检转单",
  "plan.counter": "计数录入",
  "plan.enable": "启用计划",
  "plan.disable": "停用计划",
  "route.create": "创建路线",
  "route.enable": "启用路线",
  "route.disable": "停用路线",
};

export default async function AuditPage() {
  const user = await requireUser();
  if (!canManage(user.role)) {
    return (
      <div className="card p-8 text-center text-[13px] text-muted">
        审计日志仅对系统管理员和维修主管开放。
      </div>
    );
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(120);

  return (
    <>
      <PageHeader
        eyebrow="Audit trail"
        title="审计日志"
        description="状态、权限、签名、文档与关键流转的不可编辑留痕。"
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-8" />}
          title="还没有审计记录"
          hint="设备建档、状态变更、派工、签名等操作会自动写入。"
        />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper text-muted">
                  <ShieldCheck className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-medium">
                      {ACTION_LABEL[row.action] ?? row.action}
                    </p>
                    <Badge tone="neutral">{row.entityType}</Badge>
                    {row.entityId && (
                      <span className="font-mono text-[9px] text-muted">
                        {row.entityId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {row.actorName ?? "系统"} · {fmtDateTime(row.createdAt)}
                  </p>
                  {row.detail && (
                    <p className="mt-1 break-all rounded-lg bg-paper/70 px-2 py-1 font-mono text-[9px] text-muted">
                      {JSON.stringify(row.detail)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
