import { ArrowCounterClockwise, Check, ClipboardText, MapPin, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  locations,
  repairRequests,
  workOrderEvents,
  workOrders,
} from "@/db/schema";
import { PRIORITY, WO_STATUS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { RememberReport } from "./remember-report";

export const metadata = { title: "报修进度" };

const PUBLIC_EVENT_LABEL: Record<string, string> = {
  new: "已受理建单",
  assigned: "已派工",
  in_progress: "开始维修",
  pending_acceptance: "维修完成，待验收",
  completed: "验收通过",
  closed: "工单关闭",
  cancelled: "工单取消",
};

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { token } = await params;
  const { new: isNew } = await searchParams;

  const [request] = await db
    .select({
      id: repairRequests.id,
      description: repairRequests.description,
      priority: repairRequests.priority,
      status: repairRequests.status,
      createdAt: repairRequests.createdAt,
      assetName: assets.name,
      assetCode: assets.code,
      assetToken: assets.qrToken,
      locationName: locations.name,
    })
    .from(repairRequests)
    .innerJoin(assets, eq(repairRequests.assetId, assets.id))
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .where(eq(repairRequests.publicToken, token))
    .limit(1);

  if (!request) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5">
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-honey-soft text-honey">
            <Warning className="size-6" />
          </span>
          <h1 className="mt-4 text-[18px] font-semibold">进度链接无效</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            请确认链接是否完整，或联系维修班组查询。
          </p>
        </div>
      </main>
    );
  }

  const [wo] = request
    ? await db
        .select()
        .from(workOrders)
        .where(eq(workOrders.requestId, request.id))
        .limit(1)
    : [];

  const statusMeta = wo
    ? WO_STATUS[wo.status]
    : { label: "待受理", tone: "honey" as const };

  const events = wo
    ? await db
        .select({
          toStatus: workOrderEvents.toStatus,
          createdAt: workOrderEvents.createdAt,
        })
        .from(workOrderEvents)
        .where(eq(workOrderEvents.workOrderId, wo.id))
        .orderBy(asc(workOrderEvents.createdAt))
    : [];
  const eventAt = (status: string) =>
    events.find((event) => event.toStatus === status)?.createdAt ?? null;
  const publicEvents = events.filter(
    (event) => PUBLIC_EVENT_LABEL[event.toStatus],
  );
  const overdue = Boolean(
    wo?.dueAt && !wo.closedAt && wo.dueAt.getTime() < new Date().getTime(),
  );

  const steps = [
    {
      label: "报修已提交",
      at: request.createdAt,
      done: true,
      note: "信息已进入维修队列",
    },
    {
      label: "已受理",
      at: wo?.createdAt ?? null,
      done: Boolean(wo),
      note: wo ? `工单 ${wo.code}` : "等待维修主管分诊",
    },
    {
      label: "已派工",
      at: eventAt("assigned"),
      done: Boolean(wo?.assigneeId),
      note: wo?.assigneeId ? "维修人员已接单" : "待指派维修人员",
    },
    {
      label: "维修处理中",
      at: eventAt("in_progress") ?? wo?.startedAt ?? null,
      done: Boolean(wo?.startedAt),
      note: "现场诊断与处理",
    },
    {
      label: "维修完成",
      at: eventAt("pending_acceptance") ?? wo?.completedAt ?? null,
      done: Boolean(wo?.completedAt),
      note: "等待验收确认",
    },
    {
      label: "已关闭",
      at: eventAt("closed") ?? wo?.closedAt ?? null,
      done: wo?.status === "closed",
      note: "本次报修闭环",
    },
  ];

  return (
    <main className="min-h-screen bg-paper pb-12">
      <header className="relative overflow-hidden bg-ink px-5 pb-12 pt-6 text-white">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-lg">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-[13px] font-bold">
              M
            </span>
            <div>
              <p className="text-[12px] font-medium">报修进度</p>
              <p className="font-mono text-[9px] tracking-[0.18em] text-white/40">
                YUELI · CMMS
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="label-mono !text-white/35">
              {wo?.code ?? `REQ-${request.id.slice(0, 8).toUpperCase()}`}
            </p>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">
              {statusMeta.label}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/55">
              <MapPin className="size-3.5" />
              {request.assetName} · {request.assetCode}
              {request.locationName ? ` · ${request.locationName}` : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-6 max-w-lg space-y-4 px-4">
        {isNew === "1" && (
          <div className="card flex items-center gap-3 border-mint/30 bg-mint-soft/60 p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-mint text-white">
              <Check className="size-4" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-mint">报修已提交</p>
              <p className="text-[10px] text-mint/70">
                请收藏本页面，后续进度会在这里更新。
              </p>
            </div>
          </div>
        )}

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <p className="label-mono">当前状态</p>
            <Badge tone={statusMeta.tone} dot>
              {statusMeta.label}
            </Badge>
          </div>
          <div className="mt-4 flex items-center justify-between text-[12px]">
            <span className="text-muted">提交时间</span>
            <span className="font-mono text-[11px]">
              {fmtDateTime(request.createdAt)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="text-muted">紧急程度</span>
            <Badge tone={PRIORITY[request.priority].tone}>
              {PRIORITY[request.priority].label}
            </Badge>
          </div>
          {wo?.dueAt && (
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-muted">预计完成</span>
              <span
                className={`font-mono text-[11px] ${
                  overdue ? "text-danger" : ""
                }`}
              >
                {fmtDateTime(wo.dueAt)}
                {overdue ? "（已超期）" : ""}
              </span>
            </div>
          )}
          <div className="mt-4 rounded-xl bg-paper/70 px-4 py-3">
            <p className="text-[11px] text-muted">故障描述</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              {request.description}
            </p>
          </div>
          {wo?.resolution && (
            <div className="mt-3 rounded-xl bg-mint-soft/50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11px] text-mint">
                <ClipboardText className="size-3.5" /> 处理结果
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                {wo.resolution}
              </p>
            </div>
          )}
        </section>

        <section className="card p-5">
          <p className="label-mono mb-5">处理进度</p>
          <ol className="relative space-y-5 border-l border-line pl-6">
            {steps.map((step, index) => {
              const active = step.done && !steps[index + 1]?.done;
              return (
                <li key={step.label} className="relative">
                  <span
                    className={`absolute -left-[31px] top-0.5 flex size-3 items-center justify-center rounded-full border-2 ${
                      step.done
                        ? "border-accent bg-accent"
                        : "border-line bg-paper"
                    }`}
                  >
                    {step.done && <Check className="size-2 text-white" />}
                  </span>
                  <div className="flex items-baseline justify-between gap-3">
                    <p
                      className={`text-[12px] font-medium ${
                        step.done ? "text-ink" : "text-muted"
                      }`}
                    >
                      {step.label}
                      {active && (
                        <span className="ml-2 rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] text-accent-ink">
                          进行中
                        </span>
                      )}
                    </p>
                    {step.at && (
                      <span className="shrink-0 font-mono text-[9px] text-muted">
                        {fmtDateTime(step.at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted">{step.note}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {publicEvents.length > 0 && (
          <section className="card p-5">
            <p className="label-mono mb-3">处理记录</p>
            <ul className="space-y-2.5">
              {publicEvents.map((event, index) => (
                <li
                  key={`${event.toStatus}-${index}`}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="flex items-center gap-2 text-ink-soft">
                    <span className="size-1.5 rounded-full bg-accent" />
                    {PUBLIC_EVENT_LABEL[event.toStatus]}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-muted">
                    {fmtDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[9px] leading-relaxed text-muted">
              仅展示公开处理节点，内部备注与人员信息不对外显示。
            </p>
          </section>
        )}

        <RememberReport
          assetToken={request.assetToken}
          publicToken={token}
          description={request.description}
        />

        <div className="flex items-center justify-between px-1">
          <Link
            href={`/r/${request.assetToken}`}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-ink"
          >
            <ArrowCounterClockwise className="size-3.5" /> 再报一次
          </Link>
          <p className="text-[10px] text-muted">月立集团 · 设备管理平台</p>
        </div>
      </div>
    </main>
  );
}
