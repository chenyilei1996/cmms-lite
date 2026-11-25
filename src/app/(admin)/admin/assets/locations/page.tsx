import { ArrowLeft, MapPin, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, locations } from "@/db/schema";
import {
  createLocation,
  deleteLocation,
  updateLocation,
} from "@/server/location-actions";
import { PageHeader } from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";

export const metadata = { title: "位置管理" };

const ERRORS: Record<string, string> = {
  name_required: "位置名称不能为空。",
  code_required: "位置编码不能为空。",
  duplicate: "这个编码已被其他位置占用，换一个试试。",
  in_use: "该位置下还有设备，先把这些设备改到其他位置，再删除。",
  not_found: "位置不存在或已被删除。",
};

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-[12px] outline-none focus:border-ink/30";

export default async function AdminLocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const rows = await db
    .select({
      id: locations.id,
      name: locations.name,
      code: locations.code,
      sort: locations.sort,
      assetCount: count(assets.id),
    })
    .from(locations)
    .leftJoin(assets, eq(assets.locationId, locations.id))
    .groupBy(locations.id, locations.name, locations.code, locations.sort)
    .orderBy(asc(locations.sort), asc(locations.name));

  return (
    <>
      <PageHeader
        eyebrow="Admin · locations"
        title="位置管理"
        description="维护车间、产线、区域等安装位置。设备建档与编辑时的位置下拉就来自这里，按排序值从小到大显示。"
        actions={
          <>
            <Link
              href="/admin/assets"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3.5" /> 设备台账
            </Link>
            <Link
              href="#new"
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[12px] text-white transition-opacity hover:opacity-90"
            >
              <Plus className="size-3.5" /> 新增位置
            </Link>
          </>
        }
      />

      {sp.ok && (
        <p className="mb-4 rounded-xl border border-line bg-paper/60 px-4 py-3 text-[12px] text-ink-soft">
          已保存，设备建档时的位置下拉会立即更新。
        </p>
      )}
      {sp.error && (
        <p className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[12px] text-danger">
          {ERRORS[sp.error] ?? "操作失败，请重试。"}
        </p>
      )}

      <section id="new" className="card mb-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <MapPin className="size-4 text-muted" />
          <h2 className="text-[13px] font-semibold">新增位置</h2>
        </div>
        <form action={createLocation} className="flex flex-wrap items-end gap-3">
          <label className="min-w-[160px] flex-1">
            <span className="text-[10px] text-muted">名称</span>
            <input
              name="name"
              required
              placeholder="如：二车间 / A 线 / 配电房"
              className={inputClass}
            />
          </label>
          <label className="w-32">
            <span className="text-[10px] text-muted">编码</span>
            <input name="code" required placeholder="如：C02" className={inputClass} />
          </label>
          <label className="w-24">
            <span className="text-[10px] text-muted">排序</span>
            <input name="sort" type="number" defaultValue={0} className={inputClass} />
          </label>
          <SubmitButton pendingText="新增中…" className="h-10 rounded-lg px-5">
            新增
          </SubmitButton>
        </form>
        <p className="mt-3 text-[10px] text-muted">
          编码用于快速识别，保存时自动转为大写；排序值越小越靠前。
        </p>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-paper/40 px-5 py-3">
          <h2 className="text-[13px] font-semibold">全部位置</h2>
          <span className="font-mono text-[10px] text-muted">{rows.length} 条</span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[12px] text-muted">
            还没有位置，先在上面新增一个。
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3 last:border-0 sm:px-5"
            >
              <form
                action={updateLocation}
                className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={row.id} />
                <label className="min-w-[120px] flex-1">
                  <span className="text-[10px] text-muted">名称</span>
                  <input
                    name="name"
                    defaultValue={row.name}
                    required
                    className={inputClass}
                  />
                </label>
                <label className="w-24">
                  <span className="text-[10px] text-muted">编码</span>
                  <input
                    name="code"
                    defaultValue={row.code}
                    required
                    className={inputClass}
                  />
                </label>
                <label className="w-20">
                  <span className="text-[10px] text-muted">排序</span>
                  <input
                    name="sort"
                    type="number"
                    defaultValue={row.sort}
                    className={inputClass}
                  />
                </label>
                <SubmitButton
                  size="sm"
                  variant="secondary"
                  pendingText="保存中…"
                  className="h-10 rounded-lg px-4"
                >
                  保存
                </SubmitButton>
              </form>

              <div className="flex h-10 items-center gap-2">
                <span className="font-mono text-[10px] text-muted">
                  {row.assetCount} 台设备
                </span>
                {row.assetCount > 0 ? (
                  <span
                    className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted"
                    title="位置下还有设备，不能删除"
                  >
                    使用中
                  </span>
                ) : (
                  <form action={deleteLocation}>
                    <input type="hidden" name="id" value={row.id} />
                    <ConfirmSubmitButton
                      message={`删除位置「${row.name}」？删除后不可恢复。`}
                      pendingText="删除中…"
                      className="inline-flex h-10 items-center rounded-lg border border-danger/30 px-3 text-[12px] text-danger transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      删除
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <p className="mt-4 rounded-xl border border-line bg-paper/60 px-4 py-3 text-[11px] text-muted">
        位置只用于归类与查找，不会限制设备在哪个车间运行；设备搬家时改设备的位置字段即可。
      </p>
    </>
  );
}
