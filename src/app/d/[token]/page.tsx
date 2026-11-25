import { CalendarDots, CheckCircle, ClipboardText, MapPin, Warning, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, inspectionTasks, inspectionTemplates, locations } from "@/db/schema";
import { ASSET_STATUS, PLAN_TYPE } from "@/lib/constants";
import { fmtDate, isOverdue } from "@/lib/utils";
import { Badge, ChevronRight } from "@/components/ui";
import { RecentReports } from "./recent-reports";

export const metadata = { title: "设备点检与报修" };

export default async function DevicePublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;

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

  const tasks = await db
    .select({
      id: inspectionTasks.id,
      dueAt: inspectionTasks.dueAt,
      type: inspectionTasks.type,
      templateName: inspectionTemplates.name,
      itemCount: inspectionTemplates.items,
    })
    .from(inspectionTasks)
    .innerJoin(
      inspectionTemplates,
      eq(inspectionTasks.templateId, inspectionTemplates.id),
    )
    .where(
      and(
        eq(inspectionTasks.assetId, row.id),
        eq(inspectionTasks.status, "pending"),
      ),
    )
    .orderBy(asc(inspectionTasks.dueAt))
    .limit(5);

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
              <p className="text-[12px] font-medium">设备点检与报修</p>
              <p className="font-mono text-[9px] tracking-[0.18em] text-white/40">
                YUELI · CMMS
              </p>
            </div>
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

      <div className="relative z-10 mx-auto -mt-10 max-w-lg space-y-3 px-4">
        {done === "1" && (
          <div className="flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-3 text-[12px] text-mint">
            <CheckCircle className="size-4 shrink-0" />
            点检已提交，感谢配合。
          </div>
        )}

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardText className="size-4 text-accent" />
              <h2 className="text-[13px] font-semibold">待点检任务</h2>
            </div>
            <span className="label-mono">{tasks.length} OPEN</span>
          </div>

          {tasks.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] font-medium">暂无待执行点检</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                点检任务会按保养计划自动生成。如发现设备异常，可直接提交报修。
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {tasks.map((task) => {
                const late = isOverdue(task.dueAt);
                return (
                  <li key={task.id}>
                    <Link
                      href={`/d/${token}/t/${task.id}`}
                      className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-paper/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge tone={PLAN_TYPE[task.type].tone}>
                            {PLAN_TYPE[task.type].label}
                          </Badge>
                          <p className="truncate text-[13px] font-medium">
                            {task.templateName}
                          </p>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                          <CalendarDots className="size-3.5" />
                          <span className={late ? "font-medium text-danger" : ""}>
                            {late ? "已逾期" : "到期"} {fmtDate(task.dueAt)}
                          </span>
                          <span className="text-muted/60">
                            · {task.itemCount.length} 项
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-accent" />
            <h2 className="text-[13px] font-semibold">设备报修</h2>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            设备故障、异响或停机时，可提交报修并上传现场照片，维修进度可凭链接查询。
          </p>
          <Link
            href={`/r/${token}`}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-[13px] font-medium text-white transition-colors hover:bg-ink-soft"
          >
            <Wrench className="size-4" /> 提交报修
          </Link>
        </section>

        <RecentReports assetToken={token} />

        <p className="text-center text-[10px] text-muted">
          月立集团 · 设备管理平台
        </p>
      </div>
    </main>
  );
}
