import { ArrowLeft, ArrowLineDown, ArrowLineUp, ArrowUUpLeft, ArrowsLeftRight, ClockCounterClockwise, Cube, Package, Plus, QrCode, Trash, Warning } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assetBom,
  assets,
  inventoryTransactions,
  partBatches,
  spareParts,
  warehouses,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { SPARE_PART_CATEGORIES, TXN_TYPE } from "@/lib/constants";
import { qrDataUrl, resolveBaseUrl, sparePartUrl } from "@/lib/qr";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";
import {
  issueStock,
  receiveStock,
  removeBom,
  returnStock,
  saveBom,
  transferStock,
  updateSparePart,
} from "@/server/spare-part-actions";

export const metadata = { title: "备件详情" };

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

export default async function SparePartDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const [row] = await db
    .select({ part: spareParts, warehouseName: warehouses.name })
    .from(spareParts)
    .leftJoin(warehouses, eq(spareParts.warehouseId, warehouses.id))
    .where(eq(spareParts.id, id))
    .limit(1);
  if (!row) notFound();
  const part = row.part;

  const h = await headers();
  const base = resolveBaseUrl(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto"),
  );
  const qr = await qrDataUrl(sparePartUrl(part.qrToken, base));

  const [batchRows, txnRows, bomRows, warehouseRows, assetRows] =
    await Promise.all([
      db
        .select({
          batch: partBatches,
          warehouseName: warehouses.name,
        })
        .from(partBatches)
        .leftJoin(warehouses, eq(partBatches.warehouseId, warehouses.id))
        .where(eq(partBatches.partId, id))
        .orderBy(desc(partBatches.receivedAt)),
      db
        .select({
          txn: inventoryTransactions,
          workOrderCode: workOrders.code,
          workOrderId: workOrders.id,
        })
        .from(inventoryTransactions)
        .leftJoin(workOrders, eq(inventoryTransactions.workOrderId, workOrders.id))
        .where(eq(inventoryTransactions.partId, id))
        .orderBy(desc(inventoryTransactions.createdAt))
        .limit(20),
      db
        .select({
          id: assetBom.id,
          quantity: assetBom.quantity,
          note: assetBom.note,
          assetId: assets.id,
          assetName: assets.name,
          assetCode: assets.code,
        })
        .from(assetBom)
        .innerJoin(assets, eq(assetBom.assetId, assets.id))
        .where(eq(assetBom.partId, id))
        .orderBy(asc(assets.code)),
      db
        .select({ id: warehouses.id, name: warehouses.name })
        .from(warehouses)
        .orderBy(asc(warehouses.code)),
      db
        .select({ id: assets.id, name: assets.name, code: assets.code })
        .from(assets)
        .where(inArray(assets.level, ["machine", "component"]))
        .orderBy(asc(assets.code)),
    ]);

  const low = part.stockQty < part.safetyStock;
  const stockValue = part.stockQty * Number(part.referencePrice ?? 0);
  const manageable = canManage(user.role);
  const repairable = canRepair(user.role);

  return (
    <>
      <PageHeader
        eyebrow={`${part.code} · ${part.category}`}
        title={part.name}
        description={[part.spec, part.brand, part.supplier]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <LinkButton href="/app/spare-parts" variant="secondary">
              <ArrowLeft className="size-4" /> 返回台账
            </LinkButton>
            {manageable && (
              <LinkButton
                href={`/admin/spare-parts/qr?ids=${part.id}`}
                variant="secondary"
              >
                <QrCode className="size-4" /> 扫码标签
              </LinkButton>
            )}
            <LinkButton href="/app/spare-parts/transactions" variant="secondary">
              <ClockCounterClockwise className="size-4" /> 全部流水
            </LinkButton>
          </>
        }
      />

      {sp.ok && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          库存操作已完成，批次与流水已同步更新。
        </p>
      )}
      {sp.error === "stock" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          库存不足，操作未执行。请先入库或减少数量。
        </p>
      )}
      {sp.error === "warehouse" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          调拨目标仓库不能与当前仓库相同。
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="当前库存"
          value={
            <span className={low ? "text-danger" : undefined}>
              {part.stockQty}
              <span className="ml-1 text-[14px] font-normal text-muted">
                {part.unit}
              </span>
            </span>
          }
          tone={low ? "danger" : "mint"}
          icon={<Package className="size-4" />}
          sub={low ? "低于安全库存" : "库存水位正常"}
        />
        <StatCard
          label="安全库存"
          value={`${part.safetyStock} ${part.unit}`}
          tone="honey"
          icon={<Warning className="size-4" />}
          sub={`默认仓库：${row.warehouseName ?? "未分配"}`}
        />
        <StatCard
          label="参考单价"
          value={`¥${Number(part.referencePrice ?? 0).toFixed(2)}`}
          tone="neutral"
          icon={<Cube className="size-4" />}
          sub={part.binCode ? `库位 ${part.binCode}` : "未填写库位"}
        />
        <StatCard
          label="库存金额"
          value={`¥${stockValue.toLocaleString("zh-CN", {
            maximumFractionDigits: 0,
          })}`}
          tone="accent"
          icon={<ClockCounterClockwise className="size-4" />}
          sub={`${batchRows.length} 个批次`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="card p-5 lg:p-6">
            <SectionTitle
              title="备件信息"
              extra={
                <Badge tone={low ? "danger" : "mint"} dot>
                  {low ? "需补货" : "正常"}
                </Badge>
              }
            />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[12px] sm:grid-cols-3">
              {[
                ["备件编码", part.code],
                ["类别", part.category],
                ["规格型号", part.spec ?? "—"],
                ["单位", part.unit],
                ["品牌", part.brand ?? "—"],
                ["供应商", part.supplier ?? "—"],
                ["默认仓库", row.warehouseName ?? "未分配"],
                ["库位", part.binCode ?? "—"],
                ["状态", part.active ? "启用" : "停用"],
                ["创建时间", fmtDate(part.createdAt)],
                ["最近更新", fmtDateTime(part.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] text-muted">{label}</dt>
                  <dd className="mt-1 font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {part.notes && (
              <p className="mt-4 rounded-xl bg-paper/70 px-4 py-3 text-[12px] leading-relaxed text-muted">
                {part.notes}
              </p>
            )}

            {manageable && (
              <details className="mt-4 border-t border-line pt-4">
                <summary className="cursor-pointer text-[12px] font-medium text-ink-soft">
                  编辑备件信息
                </summary>
                <form
                  action={updateSparePart}
                  className="mt-3 grid gap-2 sm:grid-cols-2"
                >
                  <input type="hidden" name="id" value={part.id} />
                  <input
                    name="name"
                    defaultValue={part.name}
                    required
                    className={inputClass}
                  />
                  <select
                    name="category"
                    defaultValue={part.category}
                    className={inputClass}
                  >
                    {SPARE_PART_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <input
                    name="spec"
                    defaultValue={part.spec ?? ""}
                    placeholder="规格型号"
                    className={inputClass}
                  />
                  <input
                    name="unit"
                    defaultValue={part.unit}
                    placeholder="单位"
                    className={inputClass}
                  />
                  <input
                    name="brand"
                    defaultValue={part.brand ?? ""}
                    placeholder="品牌"
                    className={inputClass}
                  />
                  <input
                    name="supplier"
                    defaultValue={part.supplier ?? ""}
                    placeholder="供应商"
                    className={inputClass}
                  />
                  <select
                    name="warehouseId"
                    defaultValue={part.warehouseId ?? ""}
                    className={inputClass}
                  >
                    <option value="">未分配仓库</option>
                    {warehouseRows.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="binCode"
                    defaultValue={part.binCode ?? ""}
                    placeholder="库位"
                    className={inputClass}
                  />
                  <input
                    name="safetyStock"
                    type="number"
                    min={0}
                    defaultValue={part.safetyStock}
                    placeholder="安全库存"
                    className={inputClass}
                  />
                  <input
                    name="referencePrice"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={Number(part.referencePrice ?? 0)}
                    placeholder="参考单价"
                    className={inputClass}
                  />
                  <input
                    name="notes"
                    defaultValue={part.notes ?? ""}
                    placeholder="备注"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <label className="flex items-center gap-2 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={part.active}
                      className="size-3.5 accent-ink"
                    />
                    启用该备件
                  </label>
                  <div className="flex justify-end">
                    <SubmitButton size="sm" variant="secondary">
                      保存修改
                    </SubmitButton>
                  </div>
                </form>
              </details>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[13px] font-semibold">批次库存</h2>
              <span className="label-mono">{batchRows.length} BATCHES</span>
            </div>
            {batchRows.length === 0 ? (
              <p className="px-5 py-6 text-[12px] text-muted">
                还没有入库批次，先在右侧入库。
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-line bg-paper/50">
                      <th className="px-5 py-2.5 font-medium text-muted">批次</th>
                      <th className="px-4 py-2.5 font-medium text-muted">仓库</th>
                      <th className="px-4 py-2.5 font-medium text-muted">数量</th>
                      <th className="px-4 py-2.5 font-medium text-muted">成本</th>
                      <th className="px-4 py-2.5 font-medium text-muted">入库时间</th>
                      <th className="px-4 py-2.5 font-medium text-muted">效期</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {batchRows.map(({ batch, warehouseName }) => (
                      <tr key={batch.id}>
                        <td className="px-5 py-3 font-mono text-[11px]">
                          {batch.batchNo}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {warehouseName ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-mono tabular-nums ${
                              batch.quantity === 0 ? "text-muted" : "text-ink"
                            }`}
                          >
                            {batch.quantity}
                          </span>
                          <span className="ml-1 text-[10px] text-muted">
                            {part.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted">
                          ¥{Number(batch.unitCost ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-muted">
                          {fmtDateTime(batch.receivedAt)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-muted">
                          {fmtDate(batch.expiryAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                <ClockCounterClockwise className="size-4 text-muted" /> 最近库存流水
              </h2>
              <Link
                href="/app/spare-parts/transactions"
                className="text-[11px] text-muted hover:text-ink"
              >
                查看全部
              </Link>
            </div>
            {txnRows.length === 0 ? (
              <p className="px-5 py-6 text-[12px] text-muted">还没有库存流水。</p>
            ) : (
              <ul className="divide-y divide-line">
                {txnRows.map(({ txn, workOrderCode, workOrderId }) => (
                  <li key={txn.id} className="flex items-center gap-3 px-5 py-3">
                    <Badge tone={TXN_TYPE[txn.type]?.tone ?? "neutral"}>
                      {TXN_TYPE[txn.type]?.label ?? txn.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px]">
                        <span className="font-mono font-medium">{txn.quantity}</span>{" "}
                        {part.unit}
                        {txn.note ? (
                          <span className="text-muted"> · {txn.note}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {txn.operatorName ?? "系统"} · {fmtDateTime(txn.createdAt)}
                        {workOrderId ? (
                          <>
                            {" · "}
                            <Link
                              href={`/app/work-orders/${workOrderId}`}
                              className="text-accent-ink hover:underline"
                            >
                              {workOrderCode}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-muted">
                      ¥{Number(txn.amount ?? 0).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                <Cube className="size-4 text-muted" /> 设备 BOM
              </h2>
              <span className="label-mono">{bomRows.length} ASSETS</span>
            </div>
            {bomRows.length === 0 ? (
              <EmptyState
                icon={<Cube className="size-7" />}
                title="还没有关联设备"
                hint="把备件挂到设备 BOM 上，领用时更容易找到对应件。"
              />
            ) : (
              <ul className="divide-y divide-line">
                {bomRows.map((bom) => (
                  <li key={bom.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/app/assets/${bom.assetId}`}
                        className="truncate text-[12px] font-medium hover:text-accent-ink"
                      >
                        {bom.assetName}
                      </Link>
                      <p className="mt-0.5 font-mono text-[10px] text-muted">
                        {bom.assetCode} · 单台用量 {bom.quantity} {part.unit}
                        {bom.note ? ` · ${bom.note}` : ""}
                      </p>
                    </div>
                    {manageable && (
                      <form action={removeBom}>
                        <input type="hidden" name="id" value={bom.id} />
                        <input type="hidden" name="partId" value={part.id} />
                        <input type="hidden" name="assetId" value={bom.assetId} />
                        <ConfirmSubmitButton
                          message={`从「${bom.assetName}」的 BOM 中移除该备件？`}
                          iconOnly
                          ariaLabel="移除 BOM"
                          className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash className="size-3.5" />
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {manageable && (
              <form
                action={saveBom}
                className="grid gap-2 border-t border-line bg-paper/40 px-5 py-4 sm:grid-cols-[1fr_90px_1fr_auto]"
              >
                <input type="hidden" name="partId" value={part.id} />
                <select
                  name="assetId"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    选择设备 / 部件
                  </option>
                  {assetRows.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.code} · {asset.name}
                    </option>
                  ))}
                </select>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className={inputClass}
                />
                <input
                  name="note"
                  placeholder="备注（选填）"
                  className={inputClass}
                />
                <SubmitButton size="sm" className="h-9">
                  <Plus className="size-3.5" /> 关联
                </SubmitButton>
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <SectionTitle
              title="扫码领用"
              extra={<QrCode className="size-4 text-muted" />}
            />
            <div className="flex items-center gap-4">
              <Image
                src={qr}
                alt={`${part.name} 二维码`}
                width={112}
                height={112}
                unoptimized
                className="size-28 shrink-0 rounded-xl border border-line bg-white p-1"
              />
              <div className="min-w-0">
                <p className="text-[12px] font-medium">贴在库位或料盒上</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  手机扫码进入移动领用页，登录后可直接领用并关联工单。
                </p>
                <Link
                  href={`/m/spare-parts/${part.qrToken}`}
                  className="mt-2 inline-flex text-[11px] text-accent-ink hover:underline"
                >
                  打开移动领用页 →
                </Link>
              </div>
            </div>
          </section>

          {repairable ? (
            <>
              <section className="card p-5">
                <SectionTitle
                  title="入库"
                  extra={<ArrowLineDown className="size-4 text-mint" />}
                />
                <form action={receiveStock} className="space-y-2">
                  <input type="hidden" name="partId" value={part.id} />
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    required
                    placeholder={`入库数量（${part.unit}）`}
                    className={inputClass}
                  />
                  <input
                    name="unitCost"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={Number(part.referencePrice ?? 0)}
                    placeholder="入库单价"
                    className={inputClass}
                  />
                  <input
                    name="batchNo"
                    placeholder="批次号（留空自动生成）"
                    className={inputClass}
                  />
                  <input
                    name="expiryAt"
                    type="date"
                    aria-label="有效期"
                    className={inputClass}
                  />
                  <input
                    name="note"
                    placeholder="备注（选填）"
                    className={inputClass}
                  />
                  <SubmitButton className="w-full" size="sm">
                    确认入库
                  </SubmitButton>
                </form>
              </section>

              <section className="card p-5">
                <SectionTitle
                  title="领用"
                  extra={<ArrowLineUp className="size-4 text-accent" />}
                />
                <form action={issueStock} className="space-y-2">
                  <input type="hidden" name="partId" value={part.id} />
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={part.stockQty}
                    required
                    placeholder={`领用数量（库存 ${part.stockQty}）`}
                    className={inputClass}
                  />
                  <input
                    name="note"
                    placeholder="用途 / 领用人（选填）"
                    className={inputClass}
                  />
                  <SubmitButton className="w-full" size="sm">
                    确认领用
                  </SubmitButton>
                  <p className="text-[10px] leading-relaxed text-muted">
                    工单领用请在工单详情操作，可自动归集到设备成本。
                  </p>
                </form>
              </section>

              <section className="card p-5">
                <SectionTitle
                  title="退料"
                  extra={<ArrowUUpLeft className="size-4 text-honey" />}
                />
                <form action={returnStock} className="space-y-2">
                  <input type="hidden" name="partId" value={part.id} />
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    required
                    placeholder={`退回数量（${part.unit}）`}
                    className={inputClass}
                  />
                  <input
                    name="note"
                    placeholder="退料原因（选填）"
                    className={inputClass}
                  />
                  <SubmitButton className="w-full" size="sm" variant="secondary">
                    确认退料
                  </SubmitButton>
                </form>
              </section>

              <section className="card p-5">
                <SectionTitle
                  title="调拨"
                  extra={<ArrowsLeftRight className="size-4 text-muted" />}
                />
                <form action={transferStock} className="space-y-2">
                  <input type="hidden" name="partId" value={part.id} />
                  <select name="toWarehouseId" required className={inputClass}>
                    <option value="" disabled>
                      调入仓库
                    </option>
                    {warehouseRows
                      .filter((wh) => wh.id !== part.warehouseId)
                      .map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name}
                        </option>
                      ))}
                  </select>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={part.stockQty}
                    required
                    placeholder={`调拨数量（库存 ${part.stockQty}）`}
                    className={inputClass}
                  />
                  <input
                    name="note"
                    placeholder="调拨原因（选填）"
                    className={inputClass}
                  />
                  <SubmitButton className="w-full" size="sm" variant="secondary">
                    确认调拨
                  </SubmitButton>
                </form>
              </section>
            </>
          ) : (
            <section className="card p-5">
              <SectionTitle title="库存操作" />
              <p className="text-[12px] text-muted">
                当前角色为只读，不能进行入库、领用与调拨。
              </p>
            </section>
          )}

          <section className="card p-5">
            <SectionTitle
              title="快捷入口"
              extra={<ArrowsLeftRight className="size-4 text-muted" />}
            />
            <div className="space-y-2">
              <Link
                href="/app/spare-parts/purchase-requests"
                className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12px] hover:border-ink/25"
              >
                采购申请
                <span className="text-muted">补货</span>
              </Link>
              {manageable && (
                <Link
                  href="/admin/spare-parts/stocktake"
                  className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12px] hover:border-ink/25"
                >
                  库存盘点
                  <span className="text-muted">对账</span>
                </Link>
              )}
              <Link
                href="/app/spare-parts/transactions"
                className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12px] hover:border-ink/25"
              >
                全部流水
                <span className="text-muted">追溯</span>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
