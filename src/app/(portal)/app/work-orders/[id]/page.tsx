import { ArrowLeft, ArrowUUpLeft, BookOpenText, CalendarDots, ClipboardText, Clock, Cube, Image as ImageIcon, Package, Play, Trash, User } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gt, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  attachments,
  faultCodes,
  kbArticles,
  repairRequests,
  spareParts,
  users,
  workOrderEvents,
  workOrderParts,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai-config";
import { PRIORITY, RESPONSIBILITY, WO_STATUS, WO_TYPE } from "@/lib/constants";
import { KB_CATEGORIES, type KbCategory } from "@/lib/kb";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { updateWorkOrder } from "@/server/work-order-actions";
import { KbQaPanel } from "@/components/kb-qa-panel";
import {
  Avatar,
  Badge,
  LinkButton,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";

export const metadata = { title: "工单详情" };

const flow = ["new", "assigned", "in_progress", "pending_acceptance", "completed", "closed"];

function PhotoGrid({
  label,
  rows,
}: {
  label: string;
  rows: { id: string; fileName: string }[];
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {rows.map((photo) => (
          <a
            key={photo.id}
            href={`/api/files/${photo.id}`}
            target="_blank"
            className="overflow-hidden rounded-lg border border-line"
          >
            <Image
              src={`/api/files/${photo.id}`}
              alt={photo.fileName}
              width={96}
              height={96}
              unoptimized
              className="size-24 object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const [row] = await db
    .select({
      wo: workOrders,
      assetName: assets.name,
      assetCode: assets.code,
      assetId: assets.id,
      assigneeName: users.name,
      reporterName: repairRequests.reporterName,
      reporterPhone: repairRequests.reporterPhone,
      requestDescription: repairRequests.description,
      requestId: repairRequests.id,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .leftJoin(repairRequests, eq(workOrders.requestId, repairRequests.id))
    .where(eq(workOrders.id, id))
    .limit(1);

  if (!row) notFound();
  const wo = row.wo;

  const kbMatch = [eq(kbArticles.assetId, row.assetId)];
  if (wo.faultCodeId) {
    kbMatch.push(eq(kbArticles.faultCodeId, wo.faultCodeId));
  }

  const [
    eventRows,
    requestPhotoRows,
    repairPhotoRows,
    partRows,
    sparePartRows,
    techRows,
    faultCodeRows,
    knowledgeRows,
  ] = await Promise.all([
      db
        .select({
          id: workOrderEvents.id,
          fromStatus: workOrderEvents.fromStatus,
          toStatus: workOrderEvents.toStatus,
          note: workOrderEvents.note,
          createdAt: workOrderEvents.createdAt,
          actorName: users.name,
        })
        .from(workOrderEvents)
        .leftJoin(users, eq(workOrderEvents.actorId, users.id))
        .where(eq(workOrderEvents.workOrderId, id))
        .orderBy(desc(workOrderEvents.createdAt)),
      row.requestId
        ? db
            .select({
              id: attachments.id,
              fileName: attachments.fileName,
            })
            .from(attachments)
            .where(
              and(
                eq(attachments.entityType, "repair_request"),
                eq(attachments.entityId, row.requestId),
              ),
            )
        : [],
      db
        .select({
          id: attachments.id,
          fileName: attachments.fileName,
        })
        .from(attachments)
        .where(
          and(
            eq(attachments.entityType, "work_order"),
            eq(attachments.entityId, id),
          ),
        ),
      db
        .select()
        .from(workOrderParts)
        .where(eq(workOrderParts.workOrderId, id))
        .orderBy(asc(workOrderParts.createdAt)),
      db
        .select({
          id: spareParts.id,
          code: spareParts.code,
          name: spareParts.name,
          unit: spareParts.unit,
          stockQty: spareParts.stockQty,
          referencePrice: spareParts.referencePrice,
        })
        .from(spareParts)
        .where(and(eq(spareParts.active, true), gt(spareParts.stockQty, 0)))
        .orderBy(asc(spareParts.name)),
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.role, ["technician", "manager"]))
        .orderBy(asc(users.name)),
      db
        .select({
          id: faultCodes.id,
          code: faultCodes.code,
          name: faultCodes.name,
        })
        .from(faultCodes)
        .where(eq(faultCodes.active, true))
        .orderBy(asc(faultCodes.code)),
      db
        .select({
          id: kbArticles.id,
          code: kbArticles.code,
          title: kbArticles.title,
          category: kbArticles.category,
          helpfulCount: kbArticles.helpfulCount,
        })
        .from(kbArticles)
        .where(
          and(
            eq(kbArticles.status, "published"),
            or(...kbMatch),
          ),
        )
        .orderBy(desc(kbArticles.helpfulCount), desc(kbArticles.updatedAt))
        .limit(3),
    ]);

  const currentIndex = flow.indexOf(wo.status);
  const manageable = canManage(user.role);
  const repairable = canRepair(user.role);
  const ai = await getAiConfig();
  const qaContext = [
    `${row.assetName}（${row.assetCode}）`,
    wo.faultCode ? `故障代码 ${wo.faultCode}` : "",
    `故障现象：${wo.faultPhenomenon ?? wo.title}`,
    row.requestDescription ? `报修描述：${row.requestDescription}` : "",
  ]
    .filter(Boolean)
    .join("｜")
    .slice(0, 200);
  const partCost = partRows.reduce(
    (sum, part) => sum + Number(part.amount ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow={`${wo.code} · ${row.assetCode}`}
        title={wo.title}
        description={`${row.assetName} · 创建于 ${fmtDateTime(wo.createdAt)}`}
        actions={
          <>
            <LinkButton href="/app/work-orders" variant="secondary">
              <ArrowLeft className="size-4" /> 返回看板
            </LinkButton>
            <LinkButton href={`/m/work-orders/${wo.id}`} variant="secondary">
              移动执行
            </LinkButton>
          </>
        }
      />

      {sp.error === "stock" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          备件库存不足，领用未执行。请先入库或改选其他备件。
        </p>
      )}

      <section className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <Badge tone={WO_STATUS[wo.status].tone} dot>
          {WO_STATUS[wo.status].label}
        </Badge>
        <Badge tone={WO_TYPE[wo.type]?.tone ?? "neutral"}>
          {WO_TYPE[wo.type]?.label ?? wo.type}
        </Badge>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <ClipboardText className="size-3.5" />
          优先级
          <Badge tone={PRIORITY[wo.priority].tone}>
            {PRIORITY[wo.priority].label}
          </Badge>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <User className="size-3.5" />
          {row.assigneeName ?? "待派工"}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <CalendarDots className="size-3.5" />
          期望完成 {fmtDate(wo.dueAt)}
        </span>
        {wo.downtimeMinutes != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <Clock className="size-3.5" />
            停机 {wo.downtimeMinutes} 分钟
          </span>
        )}
        {wo.laborMinutes != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <Clock className="size-3.5" />
            工时 {wo.laborMinutes} 分钟
          </span>
        )}
        {wo.signatureName && (
          <span className="text-[11px] text-muted">
            签名：{wo.signatureName} · {fmtDateTime(wo.signatureAt)}
          </span>
        )}
      </section>

      <div className="mb-4 hidden items-center gap-1 lg:flex">
        {flow.map((status, index) => (
          <div key={status} className="flex flex-1 items-center gap-1">
            <span
              className={`flex h-7 flex-1 items-center justify-center rounded-full text-[10px] font-medium ${
                index <= currentIndex
                  ? "bg-ink text-white"
                  : "bg-surface text-muted ring-1 ring-line"
              }`}
            >
              {WO_STATUS[status].label}
            </span>
            {index < flow.length - 1 && (
              <span
                className={`h-px w-2 ${
                  index < currentIndex ? "bg-ink" : "bg-line"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className="card p-5 lg:p-6">
            <SectionTitle title="故障与处理" />
            {row.requestDescription && (
              <div className="mb-4 rounded-xl bg-paper/70 px-4 py-3">
                <p className="text-[10px] text-muted">报修描述</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                  {row.requestDescription}
                </p>
                <p className="mt-2 text-[10px] text-muted">
                  报修人：{row.reporterName}
                  {row.reporterPhone ? ` · ${row.reporterPhone}` : ""}
                </p>
              </div>
            )}
            {wo.description && (
              <p className="text-[12px] leading-relaxed text-ink-soft">
                {wo.description}
              </p>
            )}
            {wo.resolution && (
              <div className="mt-4 rounded-xl bg-mint-soft/50 px-4 py-3">
                <p className="text-[10px] text-mint">处理结果</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                  {wo.resolution}
                </p>
              </div>
            )}

            {(requestPhotoRows.length > 0 || repairPhotoRows.length > 0) && (
              <div className="mt-4 space-y-3">
                {requestPhotoRows.length > 0 && (
                  <PhotoGrid label="报修照片" rows={requestPhotoRows} />
                )}
                {repairPhotoRows.length > 0 && (
                  <PhotoGrid label="维修照片" rows={repairPhotoRows} />
                )}
              </div>
            )}
          </section>

          <KbQaPanel
            ready={ai.enabled}
            model={ai.model}
            context={qaContext}
            compact
            initialQuestion={wo.faultPhenomenon ?? ""}
            placeholder="补充现象或想问的方向，例如：这类异响通常先查哪里"
          />

          <section className="card p-5 lg:p-6">
            <SectionTitle title="故障代码与原因分析" />
            <div className="grid gap-3 text-[12px] sm:grid-cols-2">
              {[
                ["故障代码", wo.faultCode ?? "未分类"],
                ["故障现象", wo.faultPhenomenon ?? "—"],
                ["故障原因", wo.faultCause ?? "—"],
                ["处理措施", wo.countermeasure ?? wo.resolution ?? "—"],
                [
                  "责任归属",
                  RESPONSIBILITY[wo.responsibility]?.label ?? "—",
                ],
                [
                  "影响产量",
                  wo.affectedOutput != null ? `${wo.affectedOutput} 件` : "—",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] text-muted">{label}</p>
                  <p className="mt-1 leading-relaxed text-ink-soft">{value}</p>
                </div>
              ))}
            </div>
            {repairable && (
              <form
                action={updateWorkOrder}
                className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2"
              >
                <input type="hidden" name="id" value={wo.id} />
                <input type="hidden" name="op" value="setFault" />
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-[10px] text-muted">
                    标准故障代码
                  </span>
                  <select
                    name="faultCodeId"
                    defaultValue={wo.faultCodeId ?? ""}
                    className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px]"
                  >
                    <option value="">未选择标准代码</option>
                    {faultCodeRows.map((code) => (
                      <option key={code.id} value={code.id}>
                        {code.code} · {code.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-[10px] text-muted">
                    责任归属
                  </span>
                  <select
                    name="responsibility"
                    defaultValue={wo.responsibility}
                    className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px]"
                  >
                    {Object.entries(RESPONSIBILITY).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-[10px] text-muted">
                    影响产量（件）
                  </span>
                  <input
                    name="affectedOutput"
                    type="number"
                    min="0"
                    defaultValue={wo.affectedOutput ?? ""}
                    placeholder="如 1200"
                    className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px]"
                  />
                </label>
                <input
                  name="faultCode"
                  defaultValue={wo.faultCode ?? ""}
                  placeholder="故障代码"
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                />
                <input
                  name="faultPhenomenon"
                  defaultValue={wo.faultPhenomenon ?? ""}
                  placeholder="故障现象"
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                />
                <input
                  name="faultCause"
                  defaultValue={wo.faultCause ?? ""}
                  placeholder="故障原因"
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                />
                <input
                  name="countermeasure"
                  defaultValue={wo.countermeasure ?? ""}
                  placeholder="对策 / 处理措施"
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                />
                <p className="text-[10px] leading-relaxed text-muted sm:col-span-2">
                  选择标准代码后，留空的现象 / 原因 / 对策会自动带入代码库内容，便于后续统计。
                </p>
                <SubmitButton variant="secondary" size="sm" className="sm:col-span-2">
                  保存故障分析
                </SubmitButton>
              </form>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[13px] font-semibold">维修用料</h2>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-ink-soft">
                  ¥{partCost.toFixed(2)}
                </span>
                <span className="label-mono">{partRows.length} ITEMS</span>
              </div>
            </div>
            {partRows.length === 0 ? (
              <p className="px-5 py-6 text-[12px] text-muted">
                还没有更换备件的记录。领用备件会自动扣减库存并计入工单成本。
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {partRows.map((part) => (
                  <li key={part.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      {part.partId ? (
                        <Link
                          href={`/app/spare-parts/${part.partId}`}
                          className="truncate text-[12px] font-medium hover:text-accent-ink"
                        >
                          {part.name}
                        </Link>
                      ) : (
                        <p className="truncate text-[12px] font-medium">{part.name}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted">
                        {part.quantity} {part.unit || "件"}
                        {part.unitPrice
                          ? ` · ¥${Number(part.unitPrice).toFixed(2)} / 单位`
                          : ""}
                        {part.amount
                          ? ` · 小计 ¥${Number(part.amount).toFixed(2)}`
                          : ""}
                        {part.note ? ` · ${part.note}` : ""}
                      </p>
                    </div>
                    {repairable &&
                      wo.status !== "closed" &&
                      wo.status !== "cancelled" && (
                        <form action={updateWorkOrder}>
                          <input type="hidden" name="id" value={wo.id} />
                          <input type="hidden" name="op" value="returnPart" />
                          <input type="hidden" name="partId" value={part.id} />
                          <ConfirmSubmitButton
                            message={`退回「${part.name}」？库存将自动回库，工单用料同步冲减。`}
                            iconOnly
                            ariaLabel={`退回 ${part.name}`}
                            className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                          >
                            {part.partId ? (
                              <ArrowUUpLeft className="size-3.5" />
                            ) : (
                              <Trash className="size-3.5" />
                            )}
                          </ConfirmSubmitButton>
                        </form>
                      )}
                  </li>
                ))}
              </ul>
            )}
            {repairable &&
              wo.status !== "closed" &&
              wo.status !== "cancelled" && (
                <>
                  {sparePartRows.length > 0 ? (
                    <form
                      action={updateWorkOrder}
                      className="grid gap-2 border-t border-line bg-paper/40 px-5 py-4 sm:grid-cols-[1fr_76px_1fr_auto]"
                    >
                      <input type="hidden" name="id" value={wo.id} />
                      <input type="hidden" name="op" value="addPart" />
                      <select
                        name="partId"
                        required
                        defaultValue=""
                        className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                      >
                        <option value="" disabled>
                          选择备件（自动扣库存）
                        </option>
                        {sparePartRows.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.code} · {part.name}（库存 {part.stockQty}{" "}
                            {part.unit}）
                          </option>
                        ))}
                      </select>
                      <input
                        name="quantity"
                        type="number"
                        min={1}
                        defaultValue={1}
                        className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                      />
                      <input
                        name="note"
                        placeholder="备注（选填）"
                        className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                      />
                      <SubmitButton size="sm" className="h-9">
                        <Package className="size-3.5" /> 领用
                      </SubmitButton>
                    </form>
                  ) : (
                    <p className="border-t border-line px-5 py-4 text-[11px] text-muted">
                      暂无有库存的备件，可先在备件模块入库，或记录临时用料。
                    </p>
                  )}
                  <details className="border-t border-line bg-paper/30 px-5 py-3">
                    <summary className="cursor-pointer text-[11px] text-muted">
                      临时用料（不扣库存）
                    </summary>
                    <form
                      action={updateWorkOrder}
                      className="mt-2 grid gap-2 sm:grid-cols-[1fr_76px_76px_1fr_auto]"
                    >
                      <input type="hidden" name="id" value={wo.id} />
                      <input type="hidden" name="op" value="addPart" />
                      <input
                        name="name"
                        required
                        placeholder="用料名称"
                        className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                      />
                      <input
                        name="quantity"
                        type="number"
                        min={1}
                        defaultValue={1}
                        className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                      />
                      <input
                        name="unit"
                        placeholder="单位"
                        className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                      />
                      <input
                        name="note"
                        placeholder="备注（选填）"
                        className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
                      />
                      <SubmitButton size="sm" variant="secondary" className="h-9">
                        记录
                      </SubmitButton>
                    </form>
                  </details>
                </>
              )}
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[13px] font-semibold">处理记录</h2>
            </div>
            <ol className="relative space-y-5 px-6 py-5">
              {eventRows.map((event, index) => (
                <li key={event.id} className="relative border-l border-line pl-6 last:border-transparent">
                  <span
                    className={`absolute -left-[5px] top-1 size-2.5 rounded-full ${
                      index === 0 ? "bg-accent" : "bg-line"
                    }`}
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[12px] font-medium">
                      {WO_STATUS[event.toStatus]?.label ?? event.toStatus}
                    </p>
                    <span className="font-mono text-[9px] text-muted">
                      {fmtDateTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">{event.note}</p>
                  <p className="mt-1 text-[10px] text-muted/70">
                    操作人：{event.actorName ?? "系统"}
                  </p>
                </li>
              ))}
              <li className="relative border-l border-transparent pl-6">
                <span className="absolute -left-[5px] top-1 size-2.5 rounded-full bg-ink" />
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12px] font-medium">工单创建</p>
                  <span className="font-mono text-[9px] text-muted">
                    {fmtDateTime(wo.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {wo.requestId ? "由扫码报修自动生成" : "内部手动创建"}
                </p>
              </li>
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card sticky top-6 p-5">
            <SectionTitle title="下一步" />
            <div className="space-y-3">
              {manageable && (wo.status === "new" || wo.status === "assigned") && (
                <form action={updateWorkOrder} className="space-y-2">
                  <input type="hidden" name="id" value={wo.id} />
                  <input type="hidden" name="op" value="assign" />
                  <select
                    name="assigneeId"
                    defaultValue={wo.assigneeId ?? ""}
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[12px]"
                    required
                  >
                    <option value="" disabled>
                      选择维修人员
                    </option>
                    {techRows.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                  <SubmitButton className="w-full" size="md">
                    确认派工
                  </SubmitButton>
                </form>
              )}

              {manageable && !["closed", "cancelled"].includes(wo.status) && (
                <form
                  action={updateWorkOrder}
                  className="space-y-2 border-t border-line pt-3"
                >
                  <input type="hidden" name="id" value={wo.id} />
                  <input type="hidden" name="op" value="transfer" />
                  <p className="text-[11px] font-medium text-ink-soft">转派 / 协同</p>
                  <select
                    name="assigneeId"
                    defaultValue=""
                    className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-[12px]"
                    required
                  >
                    <option value="" disabled>
                      转派给
                    </option>
                    {techRows.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="reason"
                    placeholder="转派原因（必填）"
                    required
                    className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px]"
                  />
                  <SubmitButton variant="secondary" size="sm" className="w-full">
                    确认转派
                  </SubmitButton>
                </form>
              )}

              {repairable && wo.status !== "in_progress" && wo.status !== "closed" && (
                <form action={updateWorkOrder}>
                  <input type="hidden" name="id" value={wo.id} />
                  <input type="hidden" name="op" value="start" />
                  <SubmitButton variant="secondary" className="w-full">
                    <Play className="size-4" /> 开始维修
                  </SubmitButton>
                </form>
              )}

              {repairable && wo.status === "in_progress" && (
                <form action={updateWorkOrder} className="space-y-2">
                  <input type="hidden" name="id" value={wo.id} />
                  <input type="hidden" name="op" value="complete" />
                  <textarea
                    name="resolution"
                    required
                    placeholder="处理措施与结果，必填"
                    className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[12px]"
                  />
                  <input
                    name="downtimeMinutes"
                    type="number"
                    min={0}
                    placeholder="停机分钟数（选填）"
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[12px]"
                  />
                  <input
                    name="laborMinutes"
                    type="number"
                    min={0}
                    placeholder="维修工时（分钟，选填）"
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[12px]"
                  />
                  <input
                    name="signatureName"
                    defaultValue={user.name}
                    placeholder="执行人签名（电子签名）"
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[12px]"
                  />
                  <SubmitButton className="w-full">提交验收</SubmitButton>
                </form>
              )}

              {manageable && wo.status === "pending_acceptance" && (
                <>
                  <form action={updateWorkOrder}>
                    <input type="hidden" name="id" value={wo.id} />
                    <input type="hidden" name="op" value="accept" />
                    <SubmitButton className="w-full">验收通过</SubmitButton>
                  </form>
                  <form action={updateWorkOrder}>
                    <input type="hidden" name="id" value={wo.id} />
                    <input type="hidden" name="op" value="reopen" />
                    <SubmitButton variant="secondary" className="w-full">
                      退回返修
                    </SubmitButton>
                  </form>
                </>
              )}

              {manageable && wo.status === "completed" && (
                <form action={updateWorkOrder}>
                  <input type="hidden" name="id" value={wo.id} />
                  <input type="hidden" name="op" value="close" />
                  <SubmitButton className="w-full">关闭归档</SubmitButton>
                </form>
              )}

              {wo.status === "closed" && (
                <p className="rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
                  工单已闭环，记录已归档。
                </p>
              )}

              {manageable &&
                ["new", "assigned", "in_progress", "pending_acceptance"].includes(
                  wo.status,
                ) && (
                  <form action={updateWorkOrder} className="border-t border-line pt-3">
                    <input type="hidden" name="id" value={wo.id} />
                    <input type="hidden" name="op" value="cancel" />
                    <SubmitButton variant="ghost" size="sm" className="w-full !text-danger">
                      取消工单
                    </SubmitButton>
                  </form>
                )}

              {!manageable && !repairable && (
                <p className="text-[12px] text-muted">当前角色为只读，不能推进工单。</p>
              )}
            </div>
          </section>

          {repairable && (
            <section className="card p-5">
              <SectionTitle
                title="维修照片"
                extra={<ImageIcon className="size-4 text-muted" />}
              />
              <form action={updateWorkOrder} className="space-y-2">
                <input type="hidden" name="id" value={wo.id} />
                <input type="hidden" name="op" value="addPhotos" />
                <label className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper/50 px-4 py-5 text-center transition-colors hover:border-ink/30">
                  <ImageIcon className="mb-1.5 size-4 text-muted" />
                  <span className="text-[11px] text-ink-soft">拍照或选择图片</span>
                  <span className="mt-0.5 text-[10px] text-muted">
                    最多 3 张，每张 ≤ 8MB
                  </span>
                  <input
                    type="file"
                    name="photos"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <SubmitButton variant="secondary" className="w-full">
                  上传维修照片
                </SubmitButton>
              </form>
            </section>
          )}

          <section className="card p-5">
            <SectionTitle
              title="关联设备"
              extra={<Cube className="size-4 text-muted" />}
            />
            <Link
              href={`/app/assets/${row.assetId}`}
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-3 transition-colors hover:border-ink/25"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-paper">
                <Cube className="size-4 text-muted" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium">{row.assetName}</p>
                <p className="font-mono text-[10px] text-muted">{row.assetCode}</p>
              </div>
            </Link>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
              <Avatar name={row.assigneeName ?? "待"} size="sm" />
              负责人：{row.assigneeName ?? "待派工"}
            </div>
          </section>

          <section className="card p-5">
            <SectionTitle
              title="相关知识"
              extra={<BookOpenText className="size-4 text-muted" />}
            />
            {knowledgeRows.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-muted">
                这台设备还没有已发布的知识。处理完成后可把现象、原因和对策沉淀下来，下次同类故障直接复用。
              </p>
            ) : (
              <ul className="space-y-2">
                {knowledgeRows.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/app/kb/${item.id}`}
                      className="block rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-ink/25"
                    >
                      <Badge tone={KB_CATEGORIES[item.category as KbCategory].tone}>
                        {KB_CATEGORIES[item.category as KbCategory].label}
                      </Badge>
                      <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug">
                        {item.title}
                      </p>
                      <p className="mt-1 font-mono text-[9px] text-muted">
                        {item.code} · {item.helpfulCount} 人觉得有用
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {repairable && (
              <LinkButton
                href={`/app/kb/new?workOrderId=${wo.id}`}
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
              >
                <BookOpenText className="size-3.5" /> 沉淀为知识
              </LinkButton>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
