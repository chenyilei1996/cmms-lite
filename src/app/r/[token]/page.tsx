import { MapPin, QrCode, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, locations } from "@/db/schema";
import { ASSET_STATUS } from "@/lib/constants";
import { Badge } from "@/components/ui";
import { findOpenRepair } from "@/server/repair";
import { RepairForm } from "./repair-form";

export const metadata = { title: "设备报修" };

export default async function RepairPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [row] = await db
    .select({
      id: assets.id,
      code: assets.code,
      name: assets.name,
      status: assets.status,
      category: assets.category,
      locationName: locations.name,
    })
    .from(assets)
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .where(eq(assets.qrToken, token))
    .limit(1);

  if (!row) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5">
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-honey-soft text-honey">
            <Warning className="size-6" />
          </span>
          <h1 className="mt-4 text-[18px] font-semibold">二维码无效</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            这个二维码可能已停用或设备已更换标签。请联系现场班组长重新获取设备二维码。
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block text-[12px] text-accent-ink underline underline-offset-4"
          >
            内部员工登录
          </Link>
        </div>
      </main>
    );
  }

  const duplicate = await findOpenRepair(row.id);

  return (
    <main className="min-h-screen bg-paper pb-10">
      <header className="relative overflow-hidden bg-ink px-5 pb-16 pt-6 text-white">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-lg">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-[13px] font-bold">
              M
            </span>
            <div>
              <p className="text-[12px] font-medium">设备报修</p>
              <p className="font-mono text-[9px] tracking-[0.18em] text-white/40">
                YUELI · CMMS
              </p>
            </div>
            <Link
              href={`/d/${token}`}
              className="ml-auto rounded-full border border-white/20 px-3 py-1 text-[10px] text-white/70"
            >
              设备页
            </Link>
          </div>

          <div className="mt-10 flex items-start justify-between gap-3">
            <div>
              <p className="label-mono !text-white/35">{row.code}</p>
              <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
                {row.name}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/55">
                <MapPin className="size-3.5" />
                {row.locationName ?? "位置未登记"} · {row.category}
              </p>
            </div>
            <Badge tone={ASSET_STATUS[row.status].tone} dot>
              {ASSET_STATUS[row.status].label}
            </Badge>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-10 max-w-lg px-4">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <QrCode className="size-4 text-accent" />
            <p className="text-[13px] font-semibold">填写故障信息</p>
          </div>
          <RepairForm assetToken={token} duplicate={duplicate} />
        </div>
        <p className="mt-4 text-center text-[10px] text-muted">
          月立集团 · 设备管理平台
        </p>
      </div>
    </main>
  );
}
