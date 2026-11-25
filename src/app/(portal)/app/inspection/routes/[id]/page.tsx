import { ArrowLeft, ArrowSquareOut, Camera, MapPin, Plus, QrCode, Trash } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inspectionPoints,
  inspectionRunItems,
  inspectionRuns,
  inspectionRoutes,
  users,
} from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { RUN_STATUS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { qrDataUrl, routeUrl } from "@/lib/qr";
import {
  addPoint,
  createManualRun,
  deletePoint,
  toggleRouteActive,
} from "@/server/route-actions";
import {
  Badge,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  SectionTitle,
  Select,
  Textarea,
} from "@/components/ui";
import { ConfirmSubmitButton, CopyButton, SubmitButton } from "@/components/ui-client";

export const metadata = { title: "点检路线详情" };

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const canEdit = canRepair(user.role);

  const [route] = await db
    .select({
      id: inspectionRoutes.id,
      name: inspectionRoutes.name,
      publicToken: inspectionRoutes.publicToken,
      cycleDays: inspectionRoutes.cycleDays,
      active: inspectionRoutes.active,
      assigneeName: users.name,
    })
    .from(inspectionRoutes)
    .leftJoin(users, eq(inspectionRoutes.assigneeId, users.id))
    .where(eq(inspectionRoutes.id, id))
    .limit(1);
  if (!route) notFound();

  const [pointRows, runRows, assetRows, qr] = await Promise.all([
    db
      .select({
        id: inspectionPoints.id,
        name: inspectionPoints.name,
        checkType: inspectionPoints.checkType,
        standardMin: inspectionPoints.standardMin,
        standardMax: inspectionPoints.standardMax,
        unit: inspectionPoints.unit,
        photoRequired: inspectionPoints.photoRequired,
        sort: inspectionPoints.sort,
        note: inspectionPoints.note,
        assetName: assets.name,
        assetCode: assets.code,
      })
      .from(inspectionPoints)
      .innerJoin(assets, eq(inspectionPoints.assetId, assets.id))
      .where(eq(inspectionPoints.routeId, id))
      .orderBy(asc(inspectionPoints.sort)),
    db
      .select({
        id: inspectionRuns.id,
        status: inspectionRuns.status,
        dueAt: inspectionRuns.dueAt,
        completedAt: inspectionRuns.completedAt,
        executorName: inspectionRuns.executorName,
      })
      .from(inspectionRuns)
      .where(eq(inspectionRuns.routeId, id))
      .orderBy(desc(inspectionRuns.dueAt))
      .limit(10),
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .orderBy(asc(assets.code)),
    qrDataUrl(routeUrl(route.publicToken)),
  ]);

  const abnormalCounts = new Map<string, number>();
  if (runRows.length) {
    const items = await db
      .select({
        runId: inspectionRunItems.runId,
        status: inspectionRunItems.status,
      })
      .from(inspectionRunItems)
      .where(eq(inspectionRunItems.status, "abnormal"));
    for (const item of items) {
      abnormalCounts.set(item.runId, (abnormalCounts.get(item.runId) ?? 0) + 1);
    }
  }

  const publicUrl = routeUrl(route.publicToken);

  return (
    <>
      <PageHeader
        eyebrow="Inspection route"
        title={route.name}
        description={`每 ${route.cycleDays} 天 · ${pointRows.length} 个点位 · 负责人 ${route.assigneeName ?? "未指派"}`}
        actions={
          <>
            <LinkButton href="/app/inspection/routes" variant="secondary">
              <ArrowLeft className="size-4" /> 返回路线
            </LinkButton>
            {canEdit && (
              <form action={createManualRun}>
                <input type="hidden" name="routeId" value={route.id} />
                <SubmitButton variant="secondary">生成待执行任务</SubmitButton>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[13px] font-semibold">点检点位（按顺序）</h2>
              <span className="label-mono">{pointRows.length} POINTS</span>
            </div>
            {pointRows.length === 0 ? (
              <EmptyState
                icon={<MapPin className="size-7" />}
                title="还没有点位"
                hint="把设备与检查项加入路线，现场扫码后按顺序填报。"
              />
            ) : (
              <ul className="divide-y divide-line">
                {pointRows.map((point, index) => (
                  <li key={point.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-paper font-mono text-[10px] text-muted">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium">
                        {point.name}
                        {point.photoRequired && (
                          <Camera className="ml-1.5 inline size-3 text-honey" />
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {point.assetName} · {point.assetCode} ·{" "}
                        {point.checkType === "number"
                          ? `数值 ${point.standardMin ?? "—"} ~ ${point.standardMax ?? "—"} ${point.unit ?? ""}`
                          : "正常 / 异常"}
                        {point.note ? ` · ${point.note}` : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <form action={deletePoint}>
                        <input type="hidden" name="id" value={point.id} />
                        <input type="hidden" name="routeId" value={route.id} />
                        <ConfirmSubmitButton
                          message={`删除点位「${point.assetName}」？扫码填报将不再包含该设备。`}
                          iconOnly
                          ariaLabel="删除点位"
                          className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash className="size-3.5" />
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canEdit && (
            <section className="card p-5">
              <SectionTitle title="新增点位" extra={<Plus className="size-4 text-muted" />} />
              <form action={addPoint} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="routeId" value={route.id} />
                <Field label="设备" required>
                  <Select name="assetId" required defaultValue="">
                    <option value="" disabled>
                      选择设备
                    </option>
                    {assetRows.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.code} · {asset.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="点位名称" required>
                  <Input name="name" placeholder="如 液压油位" required />
                </Field>
                <Field label="检查类型">
                  <Select name="checkType" defaultValue="check">
                    <option value="check">正常 / 异常</option>
                    <option value="number">数值抄表</option>
                  </Select>
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="下限">
                    <Input name="standardMin" type="number" step="0.01" placeholder="选填" />
                  </Field>
                  <Field label="上限">
                    <Input name="standardMax" type="number" step="0.01" placeholder="选填" />
                  </Field>
                  <Field label="单位">
                    <Input name="unit" placeholder="℃ / mm" />
                  </Field>
                </div>
                <Field label="排序值" hint="数字越小越靠前">
                  <Input name="sort" type="number" min={0} defaultValue={(pointRows.length + 1) * 10} />
                </Field>
                <label className="flex items-center gap-2 self-end pb-2 text-[12px] text-ink-soft">
                  <input type="checkbox" name="photoRequired" className="size-4" />
                  该点位要求拍照
                </label>
                <Field label="备注 / 标准说明" className="sm:col-span-2">
                  <Textarea name="note" placeholder="如 油位在上下刻度之间" className="min-h-20" />
                </Field>
                <div className="sm:col-span-2">
                  <SubmitButton>加入路线</SubmitButton>
                </div>
              </form>
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[13px] font-semibold">最近执行记录</h2>
            </div>
            {runRows.length === 0 ? (
              <p className="px-5 py-6 text-[12px] text-muted">还没有执行记录。</p>
            ) : (
              <ul className="divide-y divide-line">
                {runRows.map((run) => (
                  <li key={run.id} className="flex items-center gap-3 px-5 py-3">
                    <Badge tone={RUN_STATUS[run.status]?.tone ?? "neutral"}>
                      {RUN_STATUS[run.status]?.label ?? run.status}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium">
                        {run.executorName ?? "未填写执行人"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        到期 {fmtDate(run.dueAt)}
                        {run.completedAt ? ` · 完成 ${fmtDateTime(run.completedAt)}` : ""}
                      </p>
                    </div>
                    {(abnormalCounts.get(run.id) ?? 0) > 0 && (
                      <Badge tone="danger">异常 {abnormalCounts.get(run.id)}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5 text-center">
            <p className="label-mono mb-3">路线扫码入口</p>
            <div className="mx-auto w-fit rounded-2xl border border-line p-3">
              <Image
                src={qr}
                alt={`${route.name} 点检二维码`}
                width={190}
                height={190}
                unoptimized
              />
            </div>
            <p className="mt-4 text-[13px] font-medium">{route.name}</p>
            <p className="mt-1 font-mono text-[10px] text-muted">扫码点检 · 免登录填报</p>
            <div className="mt-4 flex justify-center gap-2">
              <CopyButton value={publicUrl} />
              <Link
                href={publicUrl}
                target="_blank"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] text-ink-soft hover:border-ink/25"
              >
                <ArrowSquareOut className="size-3.5" /> 打开
              </Link>
            </div>
            <p className="mt-3 break-all rounded-lg bg-paper px-2 py-1.5 font-mono text-[9px] text-muted">
              {publicUrl}
            </p>
          </section>

          <section className="card p-5">
            <SectionTitle title="路线状态" />
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">当前状态</span>
                <Badge tone={route.active ? "mint" : "neutral"}>
                  {route.active ? "启用" : "停用"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">周期</span>
                <span className="font-medium">每 {route.cycleDays} 天</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">负责人</span>
                <span className="font-medium">{route.assigneeName ?? "未指派"}</span>
              </div>
            </div>
            {canEdit && (
              <form action={toggleRouteActive} className="mt-4 border-t border-line pt-4">
                <input type="hidden" name="id" value={route.id} />
                <input type="hidden" name="active" value={route.active ? "0" : "1"} />
                <SubmitButton variant="secondary" className="w-full">
                  {route.active ? "停用路线" : "启用路线"}
                </SubmitButton>
              </form>
            )}
          </section>

          <div className="card flex items-center gap-2 px-4 py-3 text-[11px] text-muted">
            <QrCode className="size-4" />
            打印后可贴在车间入口或点检箱上。
          </div>
        </aside>
      </div>
    </>
  );
}
