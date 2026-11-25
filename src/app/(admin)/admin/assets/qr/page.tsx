import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assets, locations } from "@/db/schema";
import { qrDataUrl, deviceUrl } from "@/lib/qr";
import { LinkButton, PageHeader } from "@/components/ui";
import { QrSelector } from "@/components/qr-selector";

export const metadata = { title: "二维码打印" };

export default async function AssetQrPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = ids ? ids.split(",").filter(Boolean) : [];

  const rows = await db
    .select({
      id: assets.id,
      code: assets.code,
      name: assets.name,
      qrToken: assets.qrToken,
      locationName: locations.name,
    })
    .from(assets)
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .where(idList.length ? inArray(assets.id, idList) : undefined)
    .orderBy(asc(assets.code));

  const cards = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      qr: await qrDataUrl(deviceUrl(row.qrToken)),
    })),
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="QR labels"
          title="二维码标签"
          description="勾选需要打印的设备，再点打印。扫码进入设备页，可直接点检或报修。"
          actions={
            <LinkButton href="/app/assets" variant="secondary">
              <ArrowLeft className="size-4" /> 返回台账
            </LinkButton>
          }
        />
      </div>

      {cards.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">
          没有可打印的设备，请先在台账中新增设备。
        </div>
      ) : (
        <QrSelector cards={cards} />
      )}
    </>
  );
}
