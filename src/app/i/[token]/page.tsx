import { CheckCircle, ClipboardText, MapPin, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, inspectionPoints, inspectionRoutes } from "@/db/schema";
import { RouteRunForm } from "./route-run-form";

export const metadata = { title: "点检路线填报" };

export default async function RoutePublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;

  const [route] = await db
    .select()
    .from(inspectionRoutes)
    .where(eq(inspectionRoutes.publicToken, token))
    .limit(1);

  if (!route || !route.active) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5">
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-honey-soft text-honey">
            <Warning className="size-6" />
          </span>
          <h1 className="mt-4 text-[18px] font-semibold">路线二维码无效</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            这条点检路线可能已停用或二维码已更换，请联系设备主管重新获取。
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

  const points = await db
    .select({
      id: inspectionPoints.id,
      name: inspectionPoints.name,
      checkType: inspectionPoints.checkType,
      standardMin: inspectionPoints.standardMin,
      standardMax: inspectionPoints.standardMax,
      unit: inspectionPoints.unit,
      photoRequired: inspectionPoints.photoRequired,
      note: inspectionPoints.note,
      sort: inspectionPoints.sort,
      assetId: inspectionPoints.assetId,
      assetName: assets.name,
      assetCode: assets.code,
    })
    .from(inspectionPoints)
    .innerJoin(assets, eq(inspectionPoints.assetId, assets.id))
    .where(eq(inspectionPoints.routeId, route.id))
    .orderBy(asc(inspectionPoints.sort));

  const groupMap = new Map<
    string,
    { assetName: string; assetCode: string; points: typeof points }
  >();
  for (const point of points) {
    const group = groupMap.get(point.assetId) ?? {
      assetName: point.assetName,
      assetCode: point.assetCode,
      points: [],
    };
    group.points.push(point);
    groupMap.set(point.assetId, group);
  }
  const groups = Array.from(groupMap.values());
  const photoRequired = points.some((point) => point.photoRequired);

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
              <p className="text-[12px] font-medium">点检路线填报</p>
              <p className="font-mono text-[9px] tracking-[0.18em] text-white/40">
                YUELI · CMMS
              </p>
            </div>
          </div>

          <div className="mt-10">
            <p className="label-mono !text-white/35">INSPECTION ROUTE</p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
              {route.name}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/55">
              <MapPin className="size-3.5" />
              {groups.length} 台设备 · {points.length} 个点位 · 每 {route.cycleDays} 天
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-10 max-w-lg space-y-3 px-4">
        {done === "1" && (
          <div className="flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-3 text-[12px] text-mint">
            <CheckCircle className="size-4 shrink-0" />
            点检已提交，异常项已自动转维修工单。
          </div>
        )}

        {points.length === 0 ? (
          <section className="card p-8 text-center">
            <ClipboardText className="mx-auto size-8 text-muted" />
            <p className="mt-3 text-[14px] font-medium">路线还没有配置点位</p>
            <p className="mt-1 text-[12px] text-muted">
              请联系设备主管在后台添加设备与检查项后再扫码。
            </p>
          </section>
        ) : (
          <RouteRunForm token={token} groups={groups} photoRequired={photoRequired} />
        )}

        <p className="text-center text-[10px] text-muted">
          月立集团 · 设备管理平台
        </p>
      </div>
    </main>
  );
}
