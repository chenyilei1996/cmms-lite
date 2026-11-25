import { ArrowLeft, CheckCircle, ClipboardText, Package, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inventoryTransactions,
  spareParts,
  warehouses,
  workOrders,
} from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { TXN_TYPE } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";
import { Badge, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { mobileIssuePart } from "@/server/spare-part-actions";

export const metadata = { title: "扫码领用备件" };

export default async function MobileSparePartPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    ok?: string;
    error?: string;
    qty?: string;
    stock?: string;
    wo?: string;
  }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const [row] = await db
    .select({ part: spareParts, warehouseName: warehouses.name })
    .from(spareParts)
    .leftJoin(warehouses, eq(spareParts.warehouseId, warehouses.id))
    .where(eq(spareParts.qrToken, token))
    .limit(1);
  if (!row) notFound();
  const part = row.part;

  const [woRows, recentRows] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        code: workOrders.code,
        title: workOrders.title,
        assetName: assets.name,
      })
      .from(workOrders)
      .innerJoin(assets, eq(workOrders.assetId, assets.id))
      .where(
        inArray(workOrders.status, ["new", "assigned", "in_progress"]),
      )
      .orderBy(desc(workOrders.createdAt))
      .limit(30),
    db
      .select({
        txn: inventoryTransactions,
        workOrderCode: workOrders.code,
      })
      .from(inventoryTransactions)
      .leftJoin(workOrders, eq(inventoryTransactions.workOrderId, workOrders.id))
      .where(eq(inventoryTransactions.partId, part.id))
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(6),
  ]);

  const repairable = canRepair(user.role);
  const low = part.stockQty < part.safetyStock;
  const okQty = Number(sp.qty ?? 0);
  const okStock = Number(sp.stock ?? part.stockQty);

  return (
    <>
      <PageHeader
        eyebrow={`扫码领用 · ${part.code}`}
        title={part.name}
        description={[part.spec, row.warehouseName, part.binCode]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Link
            href={`/app/spare-parts/${part.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] text-ink-soft"
          >
            <ArrowLeft className="size-3.5" /> 完整档案
          </Link>
        }
      />

      {sp.ok === "1" && (
        <section className="card mb-4 border-mint/30 bg-mint-soft/50 p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-mint">
            <CheckCircle className="size-4" /> 领用成功
          </p>
          <p className="mt-1 text-[12px] text-ink-soft">
            已领用 <span className="font-mono font-medium">{okQty}</span>{" "}
            {part.unit}，当前库存{" "}
            <span className="font-mono font-medium">{okStock}</span> {part.unit}。
          </p>
          {sp.wo && (
            <Link
              href={`/app/work-orders/${sp.wo}`}
              className="mt-2 inline-flex text-[12px] text-accent-ink hover:underline"
            >
              查看关联工单 →
            </Link>
          )}
        </section>
      )}

      {sp.error === "stock" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          库存不足，领用未执行。请减少数量或先补货。
        </p>
      )}
      {sp.error === "inactive" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          该备件已停用，不能领用。
        </p>
      )}
      {sp.error === "wo" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          关联工单不存在或已关闭，请重新选择。
        </p>
      )}

      <section className="card mb-4 p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] text-muted">当前库存</p>
            <p
              className={`mt-1 font-mono text-[36px] font-semibold leading-none tabular-nums ${
                low ? "text-danger" : "text-ink"
              }`}
            >
              {part.stockQty}
              <span className="ml-1.5 text-[13px] font-normal text-muted">
                {part.unit}
              </span>
            </p>
            <p className="mt-2 text-[11px] text-muted">
              安全库存 {part.safetyStock} {part.unit}
            </p>
          </div>
          <div className="text-right">
            <Badge tone={low ? "danger" : "mint"} dot>
              {low ? "低于安全库存" : "库存正常"}
            </Badge>
            <p className="mt-2 font-mono text-[12px] text-ink-soft">
              ¥{Number(part.referencePrice ?? 0).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl bg-paper/70 px-3 py-2.5">
            <p className="text-[10px] text-muted">仓库</p>
            <p className="mt-0.5 font-medium">{row.warehouseName ?? "未分配"}</p>
          </div>
          <div className="rounded-xl bg-paper/70 px-3 py-2.5">
            <p className="text-[10px] text-muted">库位</p>
            <p className="mt-0.5 font-medium">{part.binCode ?? "未填写"}</p>
          </div>
        </div>
      </section>

      {repairable && part.active && part.stockQty > 0 ? (
        <form action={mobileIssuePart} className="card mb-4 space-y-3 p-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label
              htmlFor="quantity"
              className="text-[12px] font-semibold"
            >
              领用数量
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={part.stockQty}
                defaultValue={1}
                required
                className="h-14 w-28 rounded-xl border border-line bg-surface px-3 text-center font-mono text-[24px] font-semibold focus:border-ink/30 focus:outline-none focus:ring-4 focus:ring-ink/5"
              />
              <span className="text-[13px] text-muted">
                {part.unit} · 最多 {part.stockQty}
              </span>
            </div>
          </div>

          {woRows.length > 0 && (
            <label className="block">
              <span className="text-[12px] font-semibold">
                关联工单
                <span className="ml-1 font-normal text-muted">（选填）</span>
              </span>
              <select
                name="workOrderId"
                className="mt-1.5 h-12 w-full rounded-xl border border-line bg-surface px-3 text-[13px]"
              >
                <option value="">不关联工单，直接领用</option>
                {woRows.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.code} · {wo.assetName} · {wo.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <input
            name="note"
            placeholder="用途 / 备注（选填）"
            className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[13px]"
          />

          <SubmitButton size="lg" className="h-14 w-full text-[15px]">
            <Package className="size-5" /> 确认领用
          </SubmitButton>
          <p className="text-center text-[10px] text-muted">
            领用后自动扣减库存、写入流水；关联工单时同步归集备件成本
          </p>
        </form>
      ) : (
        <section className="card mb-4 p-5">
          {part.stockQty === 0 ? (
            <p className="flex items-center gap-2 text-[12px] text-danger">
              <Warning className="size-4" /> 当前库存为 0，暂不能领用。
            </p>
          ) : (
            <p className="text-[12px] text-muted">
              当前角色为只读，不能领用备件。
            </p>
          )}
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-[12px] font-semibold">
            <ClipboardText className="size-4 text-muted" /> 最近流水
          </h2>
          <Link
            href="/app/spare-parts/transactions"
            className="text-[10px] text-muted hover:text-ink"
          >
            全部
          </Link>
        </div>
        {recentRows.length === 0 ? (
          <p className="px-4 py-4 text-[11px] text-muted">还没有库存流水。</p>
        ) : (
          <ul className="divide-y divide-line">
            {recentRows.map(({ txn, workOrderCode }) => (
              <li key={txn.id} className="flex items-center gap-3 px-4 py-3">
                <Badge tone={TXN_TYPE[txn.type]?.tone ?? "neutral"}>
                  {TXN_TYPE[txn.type]?.label ?? txn.type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px]">
                    <span className="font-mono font-medium">{txn.quantity}</span>{" "}
                    {part.unit}
                    {txn.note ? (
                      <span className="text-muted"> · {txn.note}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {txn.operatorName ?? "系统"} · {fmtDateTime(txn.createdAt)}
                    {workOrderCode ? ` · ${workOrderCode}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
