import { ArrowLeft, ClipboardText, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { stocktakeItems, stocktakes, warehouses } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { STOCKTAKE_STATUS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { createStocktake } from "@/server/spare-part-actions";

export const metadata = { title: "库存盘点" };

export default async function StocktakePage() {
  const user = await requireUser();
  const manageable = canManage(user.role);

  const [sheetRows, warehouseRows] = await Promise.all([
    db
      .select({ sheet: stocktakes, warehouseName: warehouses.name })
      .from(stocktakes)
      .leftJoin(warehouses, eq(stocktakes.warehouseId, warehouses.id))
      .orderBy(desc(stocktakes.createdAt))
      .limit(50),
    db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        code: warehouses.code,
      })
      .from(warehouses)
      .orderBy(asc(warehouses.code)),
  ]);

  const sheetIds = sheetRows.map((row) => row.sheet.id);
  const itemRows = sheetIds.length
    ? await db
        .select({
          stocktakeId: stocktakeItems.stocktakeId,
          countedQty: stocktakeItems.countedQty,
          diff: stocktakeItems.diff,
        })
        .from(stocktakeItems)
        .where(inArray(stocktakeItems.stocktakeId, sheetIds))
    : [];

  const stats = new Map<
    string,
    { total: number; counted: number; diff: number }
  >();
  for (const row of itemRows) {
    const entry = stats.get(row.stocktakeId) ?? { total: 0, counted: 0, diff: 0 };
    entry.total += 1;
    if (row.countedQty !== null) entry.counted += 1;
    if (row.diff) entry.diff += 1;
    stats.set(row.stocktakeId, entry);
  }

  return (
    <>
      <PageHeader
        eyebrow="Stocktake"
        title="库存盘点"
        description="按仓库生成盘点单，录入实盘数量后自动计算盘盈盘亏并生成调整流水。"
        actions={
          <LinkButton href="/app/spare-parts" variant="secondary">
            <ArrowLeft className="size-4" /> 返回备件
          </LinkButton>
        }
      />

      {manageable && (
        <section className="card mb-4 p-5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">
            <Plus className="size-4 text-muted" /> 新建盘点单
          </h2>
          <form
            action={createStocktake}
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          >
            <select
              name="warehouseId"
              required
              className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px]"
            >
              <option value="" disabled>
                选择仓库
              </option>
              {warehouseRows.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}（{wh.code}）
                </option>
              ))}
            </select>
            <input
              name="note"
              placeholder="盘点说明（选填）"
              className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px]"
            />
            <SubmitButton size="sm" className="h-9">
              生成盘点单
            </SubmitButton>
          </form>
          <p className="mt-2 text-[10px] text-muted">
            盘点单会快照该仓库当前所有启用备件的系统库存。
          </p>
        </section>
      )}

      {sheetRows.length === 0 ? (
        <EmptyState
          icon={<ClipboardText className="size-8" />}
          title="还没有盘点单"
          hint="选择仓库生成第一张盘点单，录入实盘数量即可自动对账。"
        />
      ) : (
        <div className="space-y-3">
          {sheetRows.map(({ sheet, warehouseName }) => {
            const stat = stats.get(sheet.id) ?? {
              total: 0,
              counted: 0,
              diff: 0,
            };
            return (
              <Link
                key={sheet.id}
                href={`/admin/spare-parts/stocktake/${sheet.id}`}
                className="card flex flex-col gap-3 p-5 transition-colors hover:border-ink/25 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-paper">
                    <ClipboardText className="size-4 text-muted" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] font-medium">
                        {sheet.code}
                      </span>
                      <Badge tone={STOCKTAKE_STATUS[sheet.status].tone} dot>
                        {STOCKTAKE_STATUS[sheet.status].label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {warehouseName ?? "未指定仓库"} · 创建{" "}
                      {fmtDateTime(sheet.createdAt)}
                      {sheet.completedAt
                        ? ` · 完成 ${fmtDate(sheet.completedAt)}`
                        : ""}
                      {sheet.note ? ` · ${sheet.note}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-[11px] text-muted">
                  <span>
                    已盘{" "}
                    <span className="font-mono text-ink">
                      {stat.counted}/{stat.total}
                    </span>
                  </span>
                  <span>
                    差异{" "}
                    <span
                      className={`font-mono ${
                        stat.diff > 0 ? "text-danger" : "text-ink"
                      }`}
                    >
                      {stat.diff}
                    </span>
                  </span>
                  <span className="text-[10px]">进入盘点 →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
