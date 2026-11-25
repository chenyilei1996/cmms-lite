import { ArrowCounterClockwise, ArrowLeft, ArrowUUpLeft, Check, Package, ShoppingCart, Truck, XCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  purchaseRequestItems,
  purchaseRequests,
  spareParts,
  users,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { PURCHASE_STATUS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { Badge, buttonClass, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";
import {
  createLowStockPurchaseRequest,
  createPurchaseRequest,
  updatePurchaseRequest,
} from "@/server/spare-part-actions";

export const metadata = { title: "采购申请" };

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "submitted", label: "待审批" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已驳回" },
  { key: "draft", label: "草稿" },
  { key: "arrived", label: "已到货" },
  { key: "cancelled", label: "已取消" },
];

const OK_MESSAGES: Record<string, string> = {
  submit: "已提交审批，待主管处理。",
  withdraw: "已撤回为草稿，可修改后重新提交。",
  approve: "已审批通过，可安排到货入库。",
  reject: "已驳回申请，申请人可修改后重新提交。",
  arrive: "已标记到货，库存、批次与流水已同步更新。",
  cancel: "采购申请已取消。",
};

const ERROR_MESSAGES: Record<string, string> = {
  reason: "驳回时请填写驳回原因。",
  perm: "只有管理员或主管可以执行审批操作。",
  "not-approved": "仅审批通过的采购申请才能到货入库。",
};

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    empty?: string;
    status?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const canApprove = canManage(user.role);
  const canCreate = canRepair(user.role);
  const statusFilter = STATUS_TABS.some((tab) => tab.key === sp.status)
    ? (sp.status ?? "")
    : "";
  const approverUser = alias(users, "approver");

  const [requestRows, partRows, lowRows, statusCountRows] = await Promise.all([
    db
      .select({
        request: purchaseRequests,
        requestedByName: users.name,
        approvedByName: approverUser.name,
        itemCount: sql<number>`count(${purchaseRequestItems.id})`,
      })
      .from(purchaseRequests)
      .leftJoin(users, eq(purchaseRequests.requestedById, users.id))
      .leftJoin(
        approverUser,
        eq(purchaseRequests.approvedById, approverUser.id),
      )
      .leftJoin(
        purchaseRequestItems,
        eq(purchaseRequestItems.requestId, purchaseRequests.id),
      )
      .where(
        statusFilter
          ? sql`${purchaseRequests.status} = ${statusFilter}`
          : undefined,
      )
      .groupBy(purchaseRequests.id, users.name, approverUser.name)
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(50),
    db
      .select({
        id: spareParts.id,
        code: spareParts.code,
        name: spareParts.name,
        unit: spareParts.unit,
        referencePrice: spareParts.referencePrice,
        stockQty: spareParts.stockQty,
        safetyStock: spareParts.safetyStock,
      })
      .from(spareParts)
      .where(eq(spareParts.active, true))
      .orderBy(asc(spareParts.code)),
    db
      .select({ id: spareParts.id })
      .from(spareParts)
      .where(
        sql`${spareParts.active} = true and ${spareParts.stockQty} < ${spareParts.safetyStock}`,
      ),
    db
      .select({
        status: purchaseRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(purchaseRequests)
      .groupBy(purchaseRequests.status),
  ]);

  const statusCounts = new Map<string, number>(
    statusCountRows.map((row) => [row.status, Number(row.count)]),
  );
  const totalCount = statusCountRows.reduce(
    (sum, row) => sum + Number(row.count),
    0,
  );

  const requestIds = requestRows.map((row) => row.request.id);
  const itemRows = requestIds.length
    ? await db
        .select({
          item: purchaseRequestItems,
          partName: spareParts.name,
          partCode: spareParts.code,
          unit: spareParts.unit,
        })
        .from(purchaseRequestItems)
        .innerJoin(spareParts, eq(purchaseRequestItems.partId, spareParts.id))
        .where(inArray(purchaseRequestItems.requestId, requestIds))
        .orderBy(asc(purchaseRequestItems.createdAt))
    : [];

  const itemsByRequest = new Map<string, typeof itemRows>();
  for (const row of itemRows) {
    const list = itemsByRequest.get(row.item.requestId) ?? [];
    list.push(row);
    itemsByRequest.set(row.item.requestId, list);
  }

  return (
    <>
      <PageHeader
        eyebrow="Procurement"
        title="采购申请"
        description="技术员提交补货申请，主管审批通过后到货入库；低库存可一键生成草稿。"
        actions={
          <>
            <LinkButton href="/app/spare-parts" variant="secondary">
              <ArrowLeft className="size-4" /> 返回备件
            </LinkButton>
            {canApprove && (
              <form action={createLowStockPurchaseRequest}>
                <SubmitButton>
                  <Package className="size-4" /> 低库存生成申请
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      {sp.ok && OK_MESSAGES[sp.ok] && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          {OK_MESSAGES[sp.ok]}
        </p>
      )}
      {sp.ok === "auto" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          已根据低库存生成采购申请草稿（共 {lowRows.length} 项）。
        </p>
      )}
      {sp.ok === "create" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          采购申请已创建，可提交审批。
        </p>
      )}
      {sp.empty === "1" && (
        <p className="mb-4 rounded-xl bg-honey-soft/60 px-4 py-3 text-[12px] text-honey">
          当前没有低于安全库存的备件，无需自动补货。
        </p>
      )}
      {sp.error && ERROR_MESSAGES[sp.error] && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          {ERROR_MESSAGES[sp.error]}
        </p>
      )}

      {canCreate && (
        <section className="card mb-4 p-5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">
            <ShoppingCart className="size-4 text-muted" /> 手动新建申请
          </h2>
          <form
            action={createPurchaseRequest}
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_90px_150px_1fr_auto]"
          >
            <select name="partId" required className={inputClass}>
              <option value="" disabled>
                选择备件
              </option>
              {partRows.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.code} · {part.name}（库存 {part.stockQty} / 安全{" "}
                  {part.safetyStock}）
                </option>
              ))}
            </select>
            <input
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              className={inputClass}
              aria-label="采购数量"
            />
            <input
              name="neededAt"
              type="date"
              className={inputClass}
              aria-label="需求日期"
            />
            <input
              name="note"
              placeholder="备注（选填）"
              className={inputClass}
            />
            <SubmitButton size="sm" className="h-9">
              新建
            </SubmitButton>
          </form>
        </section>
      )}

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          const count = tab.key ? (statusCounts.get(tab.key) ?? 0) : totalCount;
          return (
            <Link
              key={tab.key || "all"}
              href={
                tab.key
                  ? `/app/spare-parts/purchase-requests?status=${tab.key}`
                  : "/app/spare-parts/purchase-requests"
              }
              className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                active
                  ? "border-ink/20 bg-ink text-paper"
                  : "border-line bg-surface text-ink-soft hover:border-ink/20"
              }`}
            >
              {tab.label}
              <span className={active ? "ml-1.5 opacity-70" : "ml-1.5 text-muted"}>
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {requestRows.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="size-8" />}
          title={statusFilter ? "该状态下没有采购申请" : "还没有采购申请"}
          hint="可手动新建，或在低库存时一键生成补货申请。"
          action={
            canCreate ? (
              <LinkButton href="/app/spare-parts/transactions" variant="secondary" size="sm">
                查看库存流水
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {requestRows.map(
            ({ request, requestedByName, approvedByName, itemCount }) => {
              const items = itemsByRequest.get(request.id) ?? [];
              const total = items.reduce(
                (sum, row) =>
                  sum +
                  row.item.quantity * Number(row.item.unitCost ?? 0),
                0,
              );
              const isOwner = request.requestedById === user.id;
              const canHandle = canApprove || isOwner;

              return (
                <section key={request.id} className="card overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] font-medium">
                          {request.code}
                        </span>
                        <Badge tone={PURCHASE_STATUS[request.status].tone} dot>
                          {PURCHASE_STATUS[request.status].label}
                        </Badge>
                        {request.source === "auto_low_stock" && (
                          <Badge tone="honey">低库存自动</Badge>
                        )}
                        <span className="text-[10px] text-muted">
                          {Number(itemCount)} 项
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        申请人 {requestedByName ?? "系统"} ·{" "}
                        {fmtDateTime(request.createdAt)}
                        {request.neededAt
                          ? ` · 需求 ${fmtDate(request.neededAt)}`
                          : ""}
                        {request.note ? ` · ${request.note}` : ""}
                      </p>
                      {request.approvedAt && (
                        <p className="mt-0.5 text-[11px] text-muted">
                          审批人 {approvedByName ?? "—"} ·{" "}
                          {fmtDateTime(request.approvedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] text-ink-soft">
                        ¥{total.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}
                      </span>

                      {(request.status === "draft" ||
                        request.status === "rejected") &&
                        canHandle && (
                          <form action={updatePurchaseRequest}>
                            <input type="hidden" name="id" value={request.id} />
                            <input type="hidden" name="op" value="submit" />
                            <SubmitButton size="sm" variant="secondary">
                              {request.status === "rejected" ? (
                                <>
                                  <ArrowCounterClockwise className="size-3.5" /> 重新提交
                                </>
                              ) : (
                                "提交审批"
                              )}
                            </SubmitButton>
                          </form>
                        )}

                      {request.status === "submitted" && canApprove && (
                        <>
                          <form action={updatePurchaseRequest}>
                            <input type="hidden" name="id" value={request.id} />
                            <input type="hidden" name="op" value="approve" />
                            <SubmitButton size="sm">
                              <Check className="size-3.5" /> 通过
                            </SubmitButton>
                          </form>
                          <details className="relative">
                            <summary className="flex h-8 cursor-pointer list-none items-center gap-1 rounded-lg border border-line px-2.5 text-[12px] text-danger hover:bg-danger-soft">
                              <XCircle className="size-3.5" /> 驳回
                            </summary>
                            <form
                              action={updatePurchaseRequest}
                              className="absolute right-0 z-10 mt-1 w-64 rounded-xl border border-line bg-surface p-3 shadow-lg"
                            >
                              <input type="hidden" name="id" value={request.id} />
                              <input type="hidden" name="op" value="reject" />
                              <textarea
                                name="reason"
                                required
                                rows={3}
                                placeholder="请填写驳回原因"
                                className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-[12px] focus:border-ink/30 focus:outline-none"
                              />
                              <SubmitButton
                                size="sm"
                                variant="ghost"
                                className="mt-2 w-full !text-danger"
                              >
                                确认驳回
                              </SubmitButton>
                            </form>
                          </details>
                        </>
                      )}

                      {request.status === "submitted" && isOwner && (
                        <form action={updatePurchaseRequest}>
                          <input type="hidden" name="id" value={request.id} />
                          <input type="hidden" name="op" value="withdraw" />
                          <SubmitButton size="sm" variant="ghost">
                            <ArrowUUpLeft className="size-3.5" /> 撤回
                          </SubmitButton>
                        </form>
                      )}

                      {request.status === "approved" && canApprove && (
                        <form action={updatePurchaseRequest}>
                          <input type="hidden" name="id" value={request.id} />
                          <input type="hidden" name="op" value="arrive" />
                          <ConfirmSubmitButton
                            message="确认到货入库？将增加库存批次与数量，并写入入库流水。"
                            pendingText="入库中…"
                            className={buttonClass("primary", "sm")}
                          >
                            <Truck className="size-3.5" /> 到货入库
                          </ConfirmSubmitButton>
                        </form>
                      )}

                      {(request.status === "draft" ||
                        request.status === "rejected" ||
                        request.status === "approved") &&
                        canHandle && (
                          <form action={updatePurchaseRequest}>
                            <input type="hidden" name="id" value={request.id} />
                            <input type="hidden" name="op" value="cancel" />
                            <ConfirmSubmitButton
                              message="取消这张采购申请？取消后无法继续审批，需要重新发起。"
                              pendingText="取消中…"
                              className={buttonClass("ghost", "sm", "!text-danger")}
                            >
                              <XCircle className="size-3.5" /> 取消
                            </ConfirmSubmitButton>
                          </form>
                        )}
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <p className="px-5 py-4 text-[12px] text-muted">没有明细。</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[12px]">
                        <thead>
                          <tr className="border-b border-line bg-paper/50">
                            <th className="px-5 py-2.5 font-medium text-muted">备件</th>
                            <th className="px-4 py-2.5 font-medium text-muted">数量</th>
                            <th className="px-4 py-2.5 font-medium text-muted">单价</th>
                            <th className="px-4 py-2.5 font-medium text-muted">金额</th>
                            <th className="px-4 py-2.5 font-medium text-muted">备注</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {items.map(({ item, partName, partCode, unit }) => (
                            <tr key={item.id}>
                              <td className="px-5 py-2.5">
                                <Link
                                  href={`/app/spare-parts/${item.partId}`}
                                  className="font-medium hover:text-accent-ink"
                                >
                                  {partName}
                                </Link>
                                <span className="mt-0.5 block font-mono text-[10px] text-muted">
                                  {partCode}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono tabular-nums">
                                {item.quantity}
                                <span className="ml-1 text-[10px] text-muted">{unit}</span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                                ¥{Number(item.unitCost ?? 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px]">
                                ¥
                                {(
                                  item.quantity * Number(item.unitCost ?? 0)
                                ).toLocaleString("zh-CN", {
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                              <td className="px-4 py-2.5 text-[11px] text-muted">
                                {item.note ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {request.status === "rejected" && request.rejectedReason && (
                    <p className="border-t border-line bg-danger-soft/50 px-5 py-2.5 text-[11px] text-danger">
                      驳回原因：{request.rejectedReason}
                    </p>
                  )}
                  {request.status === "approved" && (
                    <p className="border-t border-line bg-accent-soft/50 px-5 py-2.5 text-[11px] text-accent-ink">
                      已审批通过，等待到货入库。
                    </p>
                  )}
                  {request.status === "arrived" && (
                    <p className="border-t border-line bg-mint-soft/40 px-5 py-2.5 text-[11px] text-mint">
                      已到货入库，库存与流水已自动更新。
                    </p>
                  )}
                </section>
              );
            },
          )}
        </div>
      )}
    </>
  );
}
