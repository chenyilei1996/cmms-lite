import { Cube, MagnifyingGlass, MapPin, Plus, QrCode } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { assets, locations } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { ASSET_STATUS, CATEGORIES } from "@/lib/constants";
import { PageHeader, Badge, LinkButton, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "设备台账" };

const PAGE_SIZE = 50;

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    location?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  const category = sp.category ?? "";
  const locationId = sp.location ?? "";
  const pageNo = Math.max(1, Number(sp.page ?? "1") || 1);
  const offset = (pageNo - 1) * PAGE_SIZE;

  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(assets.name, `%${q}%`),
        ilike(assets.code, `%${q}%`),
        ilike(assets.serialNo, `%${q}%`),
      ),
    );
  }
  if (status) conditions.push(eq(assets.status, status as never));
  if (category) conditions.push(eq(assets.category, category));
  if (locationId) conditions.push(eq(assets.locationId, locationId));

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, totalRows, locationRows] = await Promise.all([
    db
      .select({
        id: assets.id,
        code: assets.code,
        name: assets.name,
        category: assets.category,
        status: assets.status,
        criticality: assets.criticality,
        warrantyUntil: assets.warrantyUntil,
        locationName: locations.name,
      })
      .from(assets)
      .leftJoin(locations, eq(assets.locationId, locations.id))
      .where(where)
      .orderBy(asc(assets.code))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ n: count() }).from(assets).where(where),
    db.select().from(locations).orderBy(asc(locations.sort)),
  ]);

  const total = Number(totalRows[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (locationId) params.set("location", locationId);
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return `/app/assets${query ? `?${query}` : ""}`;
  };

  const hasFilter = Boolean(q || status || category || locationId);

  return (
    <>
      <PageHeader
        eyebrow="Asset registry"
        title="设备台账"
        description="每台设备的身份、位置和状态。二维码是它的现场入口，扫码即可报修。"
        actions={
          manageable && (
            <>
              <LinkButton href="/admin/assets/tree" variant="secondary">
                <Cube className="size-4" /> 设备树
              </LinkButton>
              <LinkButton href="/admin/assets/qr" variant="secondary">
                <QrCode className="size-4" /> 二维码打印
              </LinkButton>
              <LinkButton href="/admin/assets/new">
                <Plus className="size-4" /> 新增设备
              </LinkButton>
            </>
          )
        }
      />

      <form
        method="get"
        className="card mb-4 flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索设备名称、编码或序列号"
            className="h-10 w-full rounded-xl border border-line bg-paper/60 pl-10 pr-3 text-[13px] placeholder:text-muted/70 focus:border-ink/30 focus:outline-none focus:ring-4 focus:ring-ink/5"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-[12px] text-ink-soft"
        >
          <option value="">全部状态</option>
          {Object.entries(ASSET_STATUS).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={category}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-[12px] text-ink-soft"
        >
          <option value="">全部类别</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          name="location"
          defaultValue={locationId}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-[12px] text-ink-soft"
        >
          <option value="">全部位置</option>
          {locationRows.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-full bg-ink px-5 text-[12px] font-medium text-white"
        >
          筛选
        </button>
        {hasFilter && (
          <Link
            href="/app/assets"
            className="flex h-10 items-center px-2 text-[12px] text-muted hover:text-ink"
          >
            重置
          </Link>
        )}
      </form>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-muted">
          共 <span className="font-mono text-ink">{total}</span> 台设备
          {totalPages > 1 ? (
            <span className="ml-2">
              · 第 {pageNo}/{totalPages} 页
            </span>
          ) : null}
        </p>
        <p className="label-mono hidden sm:block">EQ · LIVE</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Cube className="size-8" />}
          title="没有匹配的设备"
          hint="换个关键词或清空筛选条件。"
          action={
            hasFilter ? (
              <LinkButton href="/app/assets" variant="secondary" size="sm">
                清空筛选
              </LinkButton>
            ) : manageable ? (
              <LinkButton href="/admin/assets/new" size="sm">
                新增第一台设备
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
                  <th className="px-5 py-3 font-medium text-muted">设备</th>
                  <th className="px-4 py-3 font-medium text-muted">类别</th>
                  <th className="px-4 py-3 font-medium text-muted">位置</th>
                  <th className="px-4 py-3 font-medium text-muted">状态</th>
                  <th className="px-4 py-3 font-medium text-muted">关键度</th>
                  <th className="px-4 py-3 font-medium text-muted">保修至</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((asset) => (
                  <tr key={asset.id} className="transition-colors hover:bg-paper/50">
                    <td className="px-5 py-3.5">
                      <Link href={`/app/assets/${asset.id}`} className="group block">
                        <span className="block font-medium text-ink group-hover:text-accent-ink">
                          {asset.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-muted">
                          {asset.code}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{asset.category}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <MapPin className="size-3.5" />
                        {asset.locationName ?? "未分配"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={ASSET_STATUS[asset.status].tone} dot>
                        {ASSET_STATUS[asset.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        tone={
                          asset.criticality === "A"
                            ? "danger"
                            : asset.criticality === "B"
                              ? "honey"
                              : "neutral"
                        }
                      >
                        {asset.criticality} 类
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-muted">
                      {fmtDate(asset.warrantyUntil)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:hidden">
            {rows.map((asset) => (
              <Link
                key={asset.id}
                href={`/app/assets/${asset.id}`}
                className="card p-4 transition-colors active:bg-paper/70"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{asset.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">
                      {asset.code}
                    </p>
                  </div>
                  <Badge tone={ASSET_STATUS[asset.status].tone} dot>
                    {ASSET_STATUS[asset.status].label}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {asset.locationName ?? "未分配"}
                  </span>
                  <span>{asset.category}</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {pageNo > 1 && (
                <Link
                  href={pageHref(pageNo - 1)}
                  className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-4 text-[12px]"
                >
                  上一页
                </Link>
              )}
              <span className="text-[11px] text-muted">
                {pageNo} / {totalPages}
              </span>
              {pageNo < totalPages && (
                <Link
                  href={pageHref(pageNo + 1)}
                  className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-4 text-[12px]"
                >
                  下一页
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
