import { ArrowLeft, CheckCircle, Play, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, users, workOrderEvents, workOrders } from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { PRIORITY, WO_STATUS, WO_TYPE } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";
import { updateWorkOrder } from "@/server/work-order-actions";
import { Badge, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

export const metadata = { title: "移动执行" };

export default async function MobileWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [row] = await db
    .select({
      wo: workOrders,
      assetName: assets.name,
      assetCode: assets.code,
      assigneeName: users.name,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!row) notFound();

  const events = await db
    .select({
      id: workOrderEvents.id,
      note: workOrderEvents.note,
      createdAt: workOrderEvents.createdAt,
      toStatus: workOrderEvents.toStatus,
    })
    .from(workOrderEvents)
    .where(eq(workOrderEvents.workOrderId, id))
    .orderBy(desc(workOrderEvents.createdAt))
    .limit(6);

  const wo = row.wo;
  const repairable = canRepair(user.role);
  const manageable = canManage(user.role);

  return (
    <>
      <PageHeader
        eyebrow={`${wo.code} · 移动执行`}
        title={wo.title}
        description={`${row.assetName} · ${row.assetCode}`}
        actions={
          <Link
            href={`/app/work-orders/${wo.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] text-ink-soft"
          >
            <ArrowLeft className="size-3.5" /> 桌面详情
          </Link>
        }
      />

      <section className="card mb-4 flex flex-wrap items-center gap-2 p-4">
        <Badge tone={WO_STATUS[wo.status].tone} dot>
          {WO_STATUS[wo.status].label}
        </Badge>
        <Badge tone={WO_TYPE[wo.type]?.tone ?? "neutral"}>
          {WO_TYPE[wo.type]?.label ?? wo.type}
        </Badge>
        <Badge tone={PRIORITY[wo.priority].tone}>
          {PRIORITY[wo.priority].label}
        </Badge>
        <span className="text-[11px] text-muted">
          {row.assigneeName ?? "待派工"}
        </span>
      </section>

      <section className="card mb-4 p-4">
        <p className="text-[10px] text-muted">故障 / 任务描述</p>
        <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">
          {wo.description ?? "无详细描述"}
        </p>
      </section>

      {repairable && (wo.status === "new" || wo.status === "assigned") && (
        <form action={updateWorkOrder} className="mb-4">
          <input type="hidden" name="id" value={wo.id} />
          <input type="hidden" name="op" value="start" />
          <SubmitButton size="lg" className="h-14 w-full text-[15px]">
            <Play className="size-5" /> 扫码接单并开始维修
          </SubmitButton>
        </form>
      )}

      {repairable && wo.status === "in_progress" && (
        <form action={updateWorkOrder} className="card mb-4 space-y-3 p-4">
          <input type="hidden" name="id" value={wo.id} />
          <input type="hidden" name="op" value="complete" />
          <p className="text-[12px] font-semibold">完工提交</p>
          <textarea
            name="resolution"
            required
            placeholder="处理措施与结果，必填"
            className="min-h-28 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="laborMinutes"
              type="number"
              min={0}
              placeholder="维修工时（分钟）"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[12px]"
            />
            <input
              name="downtimeMinutes"
              type="number"
              min={0}
              placeholder="停机（分钟）"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[12px]"
            />
          </div>
          <input
            name="signatureName"
            defaultValue={user.name}
            placeholder="执行人签名"
            className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[13px]"
          />
          <label className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper/50 px-4 py-4 text-center">
            <span className="text-[11px] text-ink-soft">拍照上传现场照片</span>
            <span className="mt-0.5 text-[10px] text-muted">最多 3 张</span>
            <input
              type="file"
              name="photos"
              accept="image/*"
              multiple
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <SubmitButton size="lg" className="h-14 w-full text-[15px]">
            <CheckCircle className="size-5" /> 提交验收
          </SubmitButton>
        </form>
      )}

      {manageable && wo.status === "pending_acceptance" && (
        <form action={updateWorkOrder} className="mb-4">
          <input type="hidden" name="id" value={wo.id} />
          <input type="hidden" name="op" value="accept" />
          <SubmitButton size="lg" className="h-14 w-full text-[15px]">
            <Wrench className="size-5" /> 验收通过
          </SubmitButton>
        </form>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[12px] font-semibold">最近记录</h2>
        </div>
        <ul className="divide-y divide-line">
          {events.map((event) => (
            <li key={event.id} className="px-4 py-3">
              <p className="text-[11px] font-medium">
                {WO_STATUS[event.toStatus]?.label ?? event.toStatus}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                {fmtDateTime(event.createdAt)} · {event.note}
              </p>
            </li>
          ))}
          {events.length === 0 && (
            <li className="px-4 py-4 text-[11px] text-muted">还没有流转记录。</li>
          )}
        </ul>
      </section>
    </>
  );
}
