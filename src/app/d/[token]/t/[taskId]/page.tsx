import { ArrowLeft, CalendarDots, CheckCircle, ClipboardText, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inspectionTasks,
  inspectionTemplates,
  locations,
  maintenancePlans,
} from "@/db/schema";
import { PLAN_TYPE } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { InspectionForm } from "./inspection-form";

export const metadata = { title: "现场点检" };

function NoticeCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <div className="card w-full max-w-sm p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-honey-soft text-honey">
          <Warning className="size-6" />
        </span>
        <h1 className="mt-4 text-[18px] font-semibold">{title}</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{description}</p>
        <Link
          href={href}
          className="mt-5 inline-flex items-center gap-1 text-[12px] text-accent-ink underline underline-offset-4"
        >
          <ArrowLeft className="size-3.5" /> 返回设备页
        </Link>
      </div>
    </main>
  );
}

export default async function PublicInspectionPage({
  params,
}: {
  params: Promise<{ token: string; taskId: string }>;
}) {
  const { token, taskId } = await params;

  const [asset] = await db
    .select({
      id: assets.id,
      code: assets.code,
      name: assets.name,
      category: assets.category,
      locationName: locations.name,
    })
    .from(assets)
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .where(eq(assets.qrToken, token))
    .limit(1);

  if (!asset) {
    return (
      <NoticeCard
        title="二维码无效"
        description="这个二维码可能已停用或设备已更换标签，请联系现场班组长。"
        href="/login"
      />
    );
  }

  const [row] = await db
    .select({
      task: inspectionTasks,
      items: inspectionTemplates.items,
      templateName: inspectionTemplates.name,
      planName: maintenancePlans.name,
    })
    .from(inspectionTasks)
    .innerJoin(
      inspectionTemplates,
      eq(inspectionTasks.templateId, inspectionTemplates.id),
    )
    .leftJoin(maintenancePlans, eq(inspectionTasks.planId, maintenancePlans.id))
    .where(eq(inspectionTasks.id, taskId))
    .limit(1);

  if (!row || row.task.assetId !== asset.id) {
    return (
      <NoticeCard
        title="点检任务无效"
        description="该任务不存在或不属于这台设备，请返回设备页重新选择。"
        href={`/d/${token}`}
      />
    );
  }

  if (row.task.status !== "pending") {
    return (
      <NoticeCard
        title="点检已提交"
        description={`该任务已于 ${fmtDateTime(
          row.task.completedAt,
        )} 完成，无需重复填写。`}
        href={`/d/${token}`}
      />
    );
  }

  return (
    <main className="min-h-screen bg-paper pb-10">
      <header className="relative overflow-hidden bg-ink px-5 pb-16 pt-6 text-white">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-lg">
          <Link
            href={`/d/${token}`}
            className="inline-flex items-center gap-1 text-[11px] text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> 返回设备页
          </Link>

          <div className="mt-8 flex items-start justify-between gap-3">
            <div>
              <p className="label-mono !text-white/35">{asset.code}</p>
              <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em]">
                {row.templateName}
              </h1>
              <p className="mt-2 text-[12px] text-white/55">
                {asset.name}
                {asset.locationName ? ` · ${asset.locationName}` : ""}
              </p>
            </div>
            <Badge tone={PLAN_TYPE[row.task.type].tone}>
              {PLAN_TYPE[row.task.type].label}
            </Badge>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/45">
            <CalendarDots className="size-3.5" />
            到期 {fmtDate(row.task.dueAt)}
            {row.planName ? ` · 来自计划「${row.planName}」` : ""}
          </p>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-10 max-w-lg px-4">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardText className="size-4 text-accent" />
            <p className="text-[13px] font-semibold">填写点检结果</p>
          </div>
          <InspectionForm
            assetToken={token}
            taskId={row.task.id}
            items={row.items}
          />
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-muted">
          <CheckCircle className="size-3" />
          提交即完成本次点检，异常项会自动生成维修工单
        </p>
      </div>
    </main>
  );
}
