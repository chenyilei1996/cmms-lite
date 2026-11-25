import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { headers } from "next/headers";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { spareParts, warehouses } from "@/db/schema";
import { qrDataUrl, resolveBaseUrl, sparePartUrl } from "@/lib/qr";
import { LinkButton, PageHeader } from "@/components/ui";
import { QrSelector } from "@/components/qr-selector";

export const metadata = { title: "备件二维码" };

export default async function SparePartQrPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = ids ? ids.split(",").filter(Boolean) : [];
  const h = await headers();
  const base = resolveBaseUrl(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto"),
  );

  const rows = await db
    .select({
      id: spareParts.id,
      code: spareParts.code,
      name: spareParts.name,
      qrToken: spareParts.qrToken,
      warehouseName: warehouses.name,
      binCode: spareParts.binCode,
    })
    .from(spareParts)
    .leftJoin(warehouses, eq(spareParts.warehouseId, warehouses.id))
    .where(idList.length ? inArray(spareParts.id, idList) : undefined)
    .orderBy(asc(spareParts.code));

  const cards = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      locationName:
        [row.warehouseName, row.binCode].filter(Boolean).join(" · ") ||
        "未分配库位",
      qr: await qrDataUrl(sparePartUrl(row.qrToken, base)),
    })),
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="QR labels"
          title="备件二维码标签"
          description="勾选需要打印的备件，贴在库位、料盒或备件卡上。手机扫码进入移动领用页，登录后可直接领用并关联工单。请用手机可访问的局域网地址打开本页后再打印。"
          actions={
            <LinkButton href="/app/spare-parts" variant="secondary">
              <ArrowLeft className="size-4" /> 返回备件
            </LinkButton>
          }
        />
      </div>

      {cards.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">
          没有可打印的备件，请先在台账中新增备件。
        </div>
      ) : (
        <QrSelector
          cards={cards}
          printTitle="备件二维码标签"
          footer="扫码领用 · 备件管理"
          searchPlaceholder="搜索备件名称、编码或库位"
          emptyText="没有匹配的备件，换个关键词试试。"
          countUnit="种"
        />
      )}
    </>
  );
}
