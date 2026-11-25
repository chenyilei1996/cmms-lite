import { ArrowsLeftRight, ClipboardText, MagnifyingGlass, Package, Plus, QrCode, ShoppingCart, Warehouse, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  spareParts,
  stocktakeItems,
  stocktakes,
  warehouses,
} from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { SPARE_PART_CATEGORIES } from "@/lib/constants";
import { Badge, EmptyState, LinkButton, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { createWarehouse } from "@/server/spare-part-actions";

export const metadata = { title: "备件库存" };

export default async function SparePartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; low?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);

  const q = sp.q?.trim() ?? "";
  const category = sp.category ?? "";
  const lowOnly = sp.low === "1";

  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(spareParts.name, `%${q}%`),
        ilike(spareParts.code, `%${q}%`),
        ilike(spareParts.spec, `%${q}%`),
      ),
    );
  }
  if (category) conditions.push(eq(spareParts.category, category));
  if (lowOnly) {
    conditions.push(sql`${spareParts.stockQty} < ${spareParts.safetyStock}`);
  }

  const [rows, warehouseRows, stocktakeRows] = await Promise.all([
    db
      .select({
        part: spareParts,
        warehouseName: warehouses.name,
      })
      .from(spareParts)
      .leftJoin(warehouses, eq(spareParts.warehouseId, warehouses.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(spareParts.code)),
    db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        code: warehouses.code,
        address: warehouses.address,
        managerName: warehouses.managerName,
        active: warehouses.active,
        partCount: sql<number>`count(${spareParts.id})`,
      })
      .from(warehouses)
      .leftJoin(spareParts, eq(spareParts.warehouseId, warehouses.id))
      .groupBy(warehouses.id)
      .orderBy(asc(warehouses.code)),
    db
      .select({
        id: stocktakes.id,
        code: stocktakes.code,
        status: stocktakes.status,
        createdAt: stocktakes.createdAt,
        partCount: sql<number>`count(${stocktakeItems.id})`,
      })
      .from(stocktakes)
      .leftJoin(stocktakeItems, eq(stocktakeItems.stocktakeId, stocktakes.id))
      .groupBy(stocktakes.id)
      .orderBy(desc(stocktakes.createdAt)),
  ]);

  const totalParts = rows.length;
  const lowRows = rows.filter((row) => row.part.stockQty < row.part.safetyStock);
  const stockValue = rows.reduce(
    (sum, row) => sum + row.part.stockQty * Number(row.part.referencePrice ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Spare parts & inventory"
        title="备件库存"
        description="备件台账、批次库位、领用退料与补货提醒。工单领用会自动扣库存并归集成本。"
        actions={
          <>
            {manageable && (
              <LinkButton href="/admin/spare-parts/qr" variant="secondary">
                <QrCode className="size-4" /> 扫码标签
              </LinkButton>
            )}
            <LinkButton href="/app/spare-parts/transactions" variant="secondary">
              <ArrowsLeftRight className="size-4" /> 库存流水
            </LinkButton>
            <LinkButton href="/app/spare-parts/purchase-requests" variant="secondary">
              <ShoppingCart className="size-4" /> 采购申请
            </LinkButton>
            {manageable && (
              <LinkButton href="/admin/spare-parts/stocktake" variant="secondary">
                <ClipboardText className="size-4" /> 盘点
              </LinkButton>
            )}
            {manageable && (
              <LinkButton href="/admin/spare-parts/new">
                <Plus className="size-4" /> 新建备件
              </LinkButton>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="备件种类"
          value={totalParts}
          tone="mint"
          icon={<Package className="size-4" />}
          sub={`${warehouseRows.length} 个仓库`}
          className="rise rise-1"
        />
        <StatCard
          label="低库存"
          value={lowRows.length}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub={lowRows.length ? "建议立即补货" : "库存水位正常"}
          className="rise rise-2"
        />
        <StatCard
          label="库存金额"
          value={`¥${Math.round(stockValue).toLocaleString("zh-CN")}`}
          tone="honey"
          icon={<Package className="size-4" />}
          sub="按参考单价估算"
          className="rise rise-3"
        />
        <StatCard
          label="盘点单"
          value={stocktakeRows.length}
          tone="neutral"
          icon={<ClipboardText className="size-4" />}
          sub="最近创建的盘点任务"
          className="rise rise-4"
        />
      </div>

      {lowRows.length > 0 && (
        <section className="card mt-4 flex flex-col gap-3 border-danger/30 bg-danger-soft/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Warning className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="text-[12px] font-medium text-danger">
                {lowRows.length} 种备件低于安全库存
              </p>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                {lowRows
                  .slice(0, 4)
                  .map((row) => row.part.name)
                  .join("、")}
                {lowRows.length > 4 ? " 等" : ""}，可直接生成补货申请。
              </p>
            </div>
          </div>
          <LinkButton
            href="/app/spare-parts/purchase-requests"
            size="sm"
            variant="secondary"
          >
            查看并补货
          </LinkButton>
        </section>
      )}

      <form
        method="get"
        className="card mb-4 mt-4 flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索备件名称、编码或规格"
            className="h-10 w-full rounded-xl border border-line bg-paper/60 pl-10 pr-3 text-[13px] placeholder:text-muted/70 focus:border-ink/30 focus:outline-none focus:ring-4 focus:ring-ink/5"
          />
        </div>
        <select
          name="category"
          defaultValue={category}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-[12px] text-ink-soft"
        >
          <option value="">全部类别</option>
          {SPARE_PART_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[12px] text-ink-soft">
          <input
            type="checkbox"
            name="low"
            value="1"
            defaultChecked={lowOnly}
            className="size-3.5 accent-ink"
          />
          仅看低库存
        </label>
        <button
          type="submit"
          className="h-10 rounded-full bg-ink px-5 text-[12px] font-medium text-white"
        >
          筛选
        </button>
        {(q || category || lowOnly) && (
          <Link
            href="/app/spare-parts"
            className="flex h-10 items-center px-2 text-[12px] text-muted hover:text-ink"
          >
            重置
          </Link>
        )}
      </form>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-muted">
          共 <span className="font-mono text-ink">{rows.length}</span> 种备件
        </p>
        <p className="label-mono hidden sm:block">SP · INVENTORY</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package className="size-8" />}
          title="没有匹配的备件"
          hint="调整筛选条件，或先建立备件台账。"
          action={
            manageable ? (
              <LinkButton href="/admin/spare-parts/new" size="sm">
                新建备件
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line bg-paper/50">
                  <th className="px-5 py-3 font-medium text-muted">备件</th>
                  <th className="px-4 py-3 font-medium text-muted">类别</th>
                  <th className="px-4 py-3 font-medium text-muted">库位</th>
                  <th className="px-4 py-3 font-medium text-muted">库存 / 安全</th>
                  <th className="px-4 py-3 font-medium text-muted">参考单价</th>
                  <th className="px-4 py-3 font-medium text-muted">金额</th>
                  <th className="px-4 py-3 font-medium text-muted">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ part, warehouseName }) => {
                  const low = part.stockQty < part.safetyStock;
                  return (
                    <tr key={part.id} className="transition-colors hover:bg-paper/50">
                      <td className="px-5 py-3.5">
                        <Link href={`/app/spare-parts/${part.id}`} className="group block">
                          <span className="block font-medium text-ink group-hover:text-accent-ink">
                            {part.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10px] text-muted">
                            {part.code}
                            {part.spec ? ` · ${part.spec}` : ""}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-muted">{part.category}</td>
                      <td className="px-4 py-3.5 text-muted">
                        {warehouseName ?? "未分配"}
                        {part.binCode ? ` · ${part.binCode}` : ""}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`font-mono tabular-nums ${
                            low ? "text-danger" : "text-ink"
                          }`}
                        >
                          {part.stockQty}
                        </span>
                        <span className="text-muted"> / {part.safetyStock}</span>
                        <span className="ml-1 text-[10px] text-muted">{part.unit}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-muted">
                        ¥{Number(part.referencePrice ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-ink-soft">
                        ¥
                        {(
                          part.stockQty * Number(part.referencePrice ?? 0)
                        ).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone={low ? "danger" : "mint"} dot>
                          {low ? "需补货" : "正常"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:hidden">
            {rows.map(({ part, warehouseName }) => {
              const low = part.stockQty < part.safetyStock;
              return (
                <Link
                  key={part.id}
                  href={`/app/spare-parts/${part.id}`}
                  className="card p-4 transition-colors active:bg-paper/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">{part.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted">
                        {part.code}
                        {part.spec ? ` · ${part.spec}` : ""}
                      </p>
                    </div>
                    <Badge tone={low ? "danger" : "mint"} dot>
                      {low ? "需补货" : "正常"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-muted">库存</p>
                      <p
                        className={`font-mono text-[18px] font-semibold tabular-nums ${
                          low ? "text-danger" : "text-ink"
                        }`}
                      >
                        {part.stockQty}
                        <span className="ml-1 text-[10px] font-normal text-muted">
                          {part.unit} / 安全 {part.safetyStock}
                        </span>
                      </p>
                    </div>
                    <p className="text-[11px] text-muted">
                      {warehouseName ?? "未分配"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">
            <Warehouse className="size-4 text-muted" /> 仓库与库位
          </h2>
          <span className="label-mono">{warehouseRows.length} LOCATIONS</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {warehouseRows.map((row) => (
            <div key={row.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium">{row.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted">{row.code}</p>
                </div>
                <Badge tone={row.active ? "mint" : "neutral"}>
                  {row.active ? "启用" : "停用"}
                </Badge>
              </div>
              <p className="mt-3 text-[11px] text-muted">
                {row.address ?? "未填写地址"} · {row.managerName ?? "未指定管理员"}
              </p>
              <p className="mt-2 text-[11px] text-ink-soft">
                {Number(row.partCount)} 种备件
              </p>
            </div>
          ))}
        </div>

        {manageable && (
          <details className="card mt-3 p-4">
            <summary className="cursor-pointer text-[12px] font-medium text-ink-soft">
              新增仓库
            </summary>
            <form
              action={createWarehouse}
              className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_1fr_1fr_auto]"
            >
              <input
                name="name"
                required
                placeholder="仓库名称"
                className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
              />
              <input
                name="code"
                placeholder="编码（可留空）"
                className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
              />
              <input
                name="address"
                placeholder="地址"
                className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
              />
              <input
                name="managerName"
                placeholder="管理员"
                className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px]"
              />
              <SubmitButton size="sm" className="h-9">
                保存
              </SubmitButton>
            </form>
          </details>
        )}
      </section>
    </>
  );
}
