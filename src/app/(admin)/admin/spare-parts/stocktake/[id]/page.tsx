import { ArrowLeft, ClipboardText, FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  spareParts,
  stocktakeItems,
  stocktakes,
  warehouses,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { STOCKTAKE_STATUS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { Badge, buttonClass, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ui-client";
import { submitStocktake } from "@/server/spare-part-actions";

export const metadata = { title: "盘点单详情" };

export default async function StocktakeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const [row] = await db
    .select({ sheet: stocktakes, warehouseName: warehouses.name })
    .from(stocktakes)
    .leftJoin(warehouses, eq(stocktakes.warehouseId, warehouses.id))
    .where(eq(stocktakes.id, id))
    .limit(1);
  if (!row) notFound();
  const sheet = row.sheet;

  const items = await db
    .select({
      item: stocktakeItems,
      partName: spareParts.name,
      partCode: spareParts.code,
      unit: spareParts.unit,
      currentStock: spareParts.stockQty,
    })
    .from(stocktakeItems)
    .innerJoin(spareParts, eq(stocktakeItems.partId, spareParts.id))
    .where(eq(stocktakeItems.stocktakeId, id))
    .orderBy(asc(spareParts.code));

  const done = sheet.status === "done";
  const manageable = canManage(user.role);
  const countedTotal = items.filter((item) => item.item.countedQty !== null).length;
  const diffTotal = items.filter((item) => item.item.diff).length;

  return (
    <>
      <PageHeader
        eyebrow={`${sheet.code} · ${row.warehouseName ?? "未指定仓库"}`}
        title="库存盘点单"
        description={`创建于 ${fmtDateTime(sheet.createdAt)} · 共 ${items.length} 项备件`}
        actions={
          <LinkButton href="/admin/spare-parts/stocktake" variant="secondary">
            <ArrowLeft className="size-4" /> 返回盘点
          </LinkButton>
        }
      />

      {sp.ok === "1" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          盘点已提交，差异已生成调整流水并更新库存。
        </p>
      )}

      <section className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <Badge tone={STOCKTAKE_STATUS[sheet.status].tone} dot>
          {STOCKTAKE_STATUS[sheet.status].label}
        </Badge>
        <span className="text-[11px] text-muted">
          已盘 <span className="font-mono text-ink">{countedTotal}</span> /{" "}
          {items.length}
        </span>
        <span className="text-[11px] text-muted">
          差异项 <span className="font-mono text-ink">{diffTotal}</span>
        </span>
        {sheet.completedAt && (
          <span className="text-[11px] text-muted">
            完成于 {fmtDate(sheet.completedAt)}
          </span>
        )}
        {sheet.note && <span className="text-[11px] text-muted">{sheet.note}</span>}
      </section>

      {items.length === 0 ? (
        <EmptyState
          icon={<ClipboardText className="size-8" />}
          title="盘点单没有明细"
          hint="该仓库当前没有启用备件，换个仓库再试。"
        />
      ) : (
        <form action={submitStocktake} className="card overflow-hidden">
          <input type="hidden" name="id" value={sheet.id} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line bg-paper/50">
                  <th className="px-5 py-3 font-medium text-muted">备件</th>
                  <th className="px-4 py-3 font-medium text-muted">系统库存</th>
                  <th className="px-4 py-3 font-medium text-muted">实盘数量</th>
                  <th className="px-4 py-3 font-medium text-muted">差异</th>
                  <th className="px-4 py-3 font-medium text-muted">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map(({ item, partName, partCode, unit, currentStock }) => {
                  const diff = item.diff ?? 0;
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-3">
                        <Link
                          href={`/app/spare-parts/${item.partId}`}
                          className="font-medium hover:text-accent-ink"
                        >
                          {partName}
                        </Link>
                        <span className="mt-0.5 block font-mono text-[10px] text-muted">
                          {partCode} · 当前库存 {currentStock} {unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        {item.systemQty}
                      </td>
                      <td className="px-4 py-3">
                        {done ? (
                          <span className="font-mono tabular-nums">
                            {item.countedQty ?? "—"}
                          </span>
                        ) : (
                          <input
                            name={`counted_${item.id}`}
                            type="number"
                            min={0}
                            defaultValue={item.countedQty ?? item.systemQty}
                            className="h-9 w-24 rounded-lg border border-line bg-surface px-3 font-mono text-[12px] focus:border-ink/30 focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.countedQty === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span
                            className={`font-mono tabular-nums ${
                              diff > 0
                                ? "text-mint"
                                : diff < 0
                                  ? "text-danger"
                                  : "text-muted"
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {done ? (
                          <span className="text-[11px] text-muted">
                            {item.note ?? "—"}
                          </span>
                        ) : (
                          <input
                            name={`note_${item.id}`}
                            defaultValue={item.note ?? ""}
                            placeholder="差异原因（选填）"
                            className="h-9 w-full min-w-40 rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!done && manageable && (
            <div className="flex flex-col gap-2 border-t border-line bg-paper/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted">
                提交后将按实盘数量调整库存，并写入盘点调整流水。此操作不可重复提交。
              </p>
              <ConfirmSubmitButton
                message="提交盘点后会按实盘数量调整库存并生成调整流水，且无法重复提交。确认提交？"
                pendingText="提交中…"
                className={buttonClass("primary", "md")}
              >
                <FloppyDisk className="size-4" /> 提交盘点
              </ConfirmSubmitButton>
            </div>
          )}
          {!done && !manageable && (
            <p className="border-t border-line px-5 py-4 text-[12px] text-muted">
              当前角色为只读，不能提交盘点。
            </p>
          )}
        </form>
      )}
    </>
  );
}
