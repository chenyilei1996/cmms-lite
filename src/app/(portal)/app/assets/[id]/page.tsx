import { ArrowLeft, ArrowSquareOut, BookOpenText, CalendarDots, ClipboardText, ClockCounterClockwise, FileText, MapPin, Package, QrCode, Trash, Wrench } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  assetBom,
  assetDocuments,
  assetStatusHistory,
  assets,
  attachments,
  inspectionPoints,
  inspectionRoutes,
  inspectionTasks,
  inspectionTemplates,
  kbArticles,
  locations,
  maintenancePlans,
  spareParts,
  users,
  workOrderParts,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { KB_CATEGORIES, type KbCategory } from "@/lib/kb";
import {
  ASSET_LEVEL,
  ASSET_STATUS,
  COUNTER_TYPE,
  PLAN_TYPE,
  PM_TRIGGER,
  TASK_STATUS,
  WO_STATUS,
  WO_TYPE,
} from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { deviceUrl, qrDataUrl } from "@/lib/qr";
import {
  addAssetDocument,
  deleteAssetDocument,
  updateAssetStatus,
} from "@/server/asset-actions";
import {
  Badge,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  SectionTitle,
  Select,
} from "@/components/ui";
import { ConfirmSubmitButton, CopyButton, SubmitButton } from "@/components/ui-client";
import { AssetProfileForm } from "./asset-profile-form";

export const metadata = { title: "一机一档" };

const tabs = [
  { key: "overview", label: "概览" },
  { key: "profile", label: "参数" },
  { key: "docs", label: "文档" },
  { key: "parts", label: "部件" },
  { key: "workorders", label: "工单" },
  { key: "inspection", label: "点检" },
  { key: "history", label: "履历" },
];

function specsToText(specs: Record<string, string> | null | undefined) {
  if (!specs) return "";
  return Object.entries(specs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const user = await requireUser();

  const [row] = await db
    .select({
      asset: assets,
      locationName: locations.name,
    })
    .from(assets)
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .where(eq(assets.id, id))
    .limit(1);
  if (!row) notFound();
  const asset = row.asset;

  const [parentRow] = asset.parentId
    ? await db
        .select({ id: assets.id, name: assets.name, code: assets.code })
        .from(assets)
        .where(eq(assets.id, asset.parentId))
        .limit(1)
    : [];

  const [
    woRows,
    planRows,
    docRows,
    childRows,
    historyRows,
    taskRows,
    pointRows,
    bomRows,
    consumptionRows,
    knowledgeRows,
    qr,
  ] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        code: workOrders.code,
        title: workOrders.title,
        status: workOrders.status,
        type: workOrders.type,
        createdAt: workOrders.createdAt,
      })
      .from(workOrders)
      .where(eq(workOrders.assetId, id))
      .orderBy(desc(workOrders.createdAt))
      .limit(20),
    db
      .select({
        id: maintenancePlans.id,
        name: maintenancePlans.name,
        type: maintenancePlans.type,
        triggerType: maintenancePlans.triggerType,
        counterType: maintenancePlans.counterType,
        counterInterval: maintenancePlans.counterInterval,
        cycleDays: maintenancePlans.cycleDays,
        nextDueAt: maintenancePlans.nextDueAt,
        active: maintenancePlans.active,
        templateName: inspectionTemplates.name,
      })
      .from(maintenancePlans)
      .innerJoin(
        inspectionTemplates,
        eq(maintenancePlans.templateId, inspectionTemplates.id),
      )
      .where(eq(maintenancePlans.assetId, id)),
    db
      .select({
        id: assetDocuments.id,
        name: assetDocuments.name,
        category: assetDocuments.category,
        version: assetDocuments.version,
        note: assetDocuments.note,
        attachmentId: assetDocuments.attachmentId,
        fileName: attachments.fileName,
        createdAt: assetDocuments.createdAt,
      })
      .from(assetDocuments)
      .leftJoin(attachments, eq(assetDocuments.attachmentId, attachments.id))
      .where(eq(assetDocuments.assetId, id))
      .orderBy(desc(assetDocuments.createdAt)),
    db
      .select({
        id: assets.id,
        code: assets.code,
        name: assets.name,
        level: assets.level,
        status: assets.status,
      })
      .from(assets)
      .where(eq(assets.parentId, id))
      .orderBy(asc(assets.code)),
    db
      .select({
        id: assetStatusHistory.id,
        fromStatus: assetStatusHistory.fromStatus,
        toStatus: assetStatusHistory.toStatus,
        reason: assetStatusHistory.reason,
        source: assetStatusHistory.source,
        createdAt: assetStatusHistory.createdAt,
        actorName: users.name,
      })
      .from(assetStatusHistory)
      .leftJoin(users, eq(assetStatusHistory.actorId, users.id))
      .where(eq(assetStatusHistory.assetId, id))
      .orderBy(desc(assetStatusHistory.createdAt))
      .limit(40),
    db
      .select({
        id: inspectionTasks.id,
        dueAt: inspectionTasks.dueAt,
        status: inspectionTasks.status,
        type: inspectionTasks.type,
        completedAt: inspectionTasks.completedAt,
        templateName: inspectionTemplates.name,
      })
      .from(inspectionTasks)
      .innerJoin(
        inspectionTemplates,
        eq(inspectionTasks.templateId, inspectionTemplates.id),
      )
      .where(eq(inspectionTasks.assetId, id))
      .orderBy(desc(inspectionTasks.dueAt))
      .limit(10),
    db
      .select({
        id: inspectionPoints.id,
        name: inspectionPoints.name,
        standardMin: inspectionPoints.standardMin,
        standardMax: inspectionPoints.standardMax,
        unit: inspectionPoints.unit,
        routeId: inspectionRoutes.id,
        routeName: inspectionRoutes.name,
      })
      .from(inspectionPoints)
      .innerJoin(
        inspectionRoutes,
        eq(inspectionPoints.routeId, inspectionRoutes.id),
      )
      .where(eq(inspectionPoints.assetId, id)),
    db
      .select({
        id: assetBom.id,
        quantity: assetBom.quantity,
        note: assetBom.note,
        partId: spareParts.id,
        partName: spareParts.name,
        partCode: spareParts.code,
        unit: spareParts.unit,
        stockQty: spareParts.stockQty,
        safetyStock: spareParts.safetyStock,
      })
      .from(assetBom)
      .innerJoin(spareParts, eq(assetBom.partId, spareParts.id))
      .where(eq(assetBom.assetId, id))
      .orderBy(asc(spareParts.code)),
    db
      .select({
        id: workOrderParts.id,
        name: workOrderParts.name,
        quantity: workOrderParts.quantity,
        unit: workOrderParts.unit,
        amount: workOrderParts.amount,
        partId: workOrderParts.partId,
        createdAt: workOrderParts.createdAt,
        workOrderId: workOrders.id,
        workOrderCode: workOrders.code,
      })
      .from(workOrderParts)
      .innerJoin(workOrders, eq(workOrderParts.workOrderId, workOrders.id))
      .where(eq(workOrders.assetId, id))
      .orderBy(desc(workOrderParts.createdAt))
      .limit(30),
    db
      .select({
        id: kbArticles.id,
        code: kbArticles.code,
        title: kbArticles.title,
        category: kbArticles.category,
        summary: kbArticles.summary,
        helpfulCount: kbArticles.helpfulCount,
      })
      .from(kbArticles)
      .where(
        and(
          eq(kbArticles.status, "published"),
          or(
            eq(kbArticles.assetId, id),
            eq(kbArticles.assetCategory, asset.category),
          ),
        ),
      )
      .orderBy(desc(kbArticles.helpfulCount), desc(kbArticles.updatedAt))
      .limit(4),
    qrDataUrl(deviceUrl(asset.qrToken)),
  ]);

  const publicUrl = deviceUrl(asset.qrToken);
  const currentTab = tabs.some((item) => item.key === tab) ? tab : "overview";
  const manageable = canManage(user.role);
  const repairable = canRepair(user.role);
  const partCostTotal = consumptionRows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );
  const statusHistory = historyRows;

  return (
    <>
      <PageHeader
        eyebrow={`${asset.code} · ${ASSET_LEVEL[asset.level]?.label ?? "设备"}`}
        title={asset.name}
        description={[
          asset.category,
          row.locationName,
          parentRow ? `上级：${parentRow.name}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <LinkButton href="/app/assets" variant="secondary">
              <ArrowLeft className="size-4" /> 返回
            </LinkButton>
            {manageable && (
              <LinkButton
                href={`/admin/assets/qr?ids=${asset.id}`}
                variant="secondary"
              >
                <QrCode className="size-4" /> 打印标签
              </LinkButton>
            )}
          </>
        }
      />

      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={`/app/assets/${asset.id}?tab=${item.key}`}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-[12px] font-medium transition-colors ${
              currentTab === item.key
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          {currentTab === "overview" && (
            <>
              <section className="card p-5 lg:p-6">
                <SectionTitle
                  title="设备信息"
                  extra={
                    <Badge tone={ASSET_STATUS[asset.status]?.tone ?? "neutral"} dot>
                      {ASSET_STATUS[asset.status]?.label ?? asset.status}
                    </Badge>
                  }
                />
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[12px] sm:grid-cols-3">
                  {[
                    ["设备编码", asset.code],
                    ["设备类别", asset.category],
                    ["层级", ASSET_LEVEL[asset.level]?.label ?? asset.level],
                    ["上级节点", parentRow ? parentRow.name : "—"],
                    ["安装位置", asset.installLocation ?? row.locationName ?? "未分配"],
                    ["责任人", asset.responsibleName ?? "—"],
                    ["制造商", asset.manufacturer ?? "—"],
                    ["供应商", asset.vendor ?? "—"],
                    ["型号", asset.model ?? "—"],
                    ["序列号", asset.serialNo ?? "—"],
                    ["关键度", `${asset.criticality} 类`],
                    ["采购日期", fmtDate(asset.purchaseDate)],
                    ["保修截止", fmtDate(asset.warrantyUntil)],
                    [
                      "购置金额",
                      asset.purchaseCost
                        ? `¥ ${Number(asset.purchaseCost).toLocaleString("zh-CN")}`
                        : "—",
                    ],
                    [
                      "折旧年限",
                      asset.depreciationMonths
                        ? `${asset.depreciationMonths} 个月`
                        : "—",
                    ],
                    [
                      "备件消耗",
                      partCostTotal > 0
                        ? `¥ ${partCostTotal.toLocaleString("zh-CN", {
                            maximumFractionDigits: 0,
                          })}`
                        : "—",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] text-muted">{label}</dt>
                      <dd className="mt-1 font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
                {asset.notes && (
                  <p className="mt-5 rounded-xl bg-paper/70 px-4 py-3 text-[12px] leading-relaxed text-muted">
                    {asset.notes}
                  </p>
                )}
              </section>

              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <ClipboardText className="size-4 text-muted" /> 最近工单
                  </h2>
                  <Link
                    href={`/app/assets/${asset.id}?tab=workorders`}
                    className="text-[11px] text-muted hover:text-ink"
                  >
                    查看全部
                  </Link>
                </div>
                {woRows.length === 0 ? (
                  <EmptyState
                    icon={<Wrench className="size-7" />}
                    title="还没有维修记录"
                    hint="扫码报修后，工单会自动出现在这里。"
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {woRows.slice(0, 5).map((wo) => (
                      <li key={wo.id}>
                        <Link
                          href={`/app/work-orders/${wo.id}`}
                          className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                        >
                          <Badge tone={WO_TYPE[wo.type]?.tone ?? "neutral"}>
                            {WO_TYPE[wo.type]?.label ?? wo.type}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium">{wo.title}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-muted">
                              {wo.code} · {fmtDateTime(wo.createdAt)}
                            </p>
                          </div>
                          <Badge tone={WO_STATUS[wo.status].tone}>
                            {WO_STATUS[wo.status].label}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <BookOpenText className="size-4 text-muted" /> 相关知识
                  </h2>
                  <Link
                    href={`/app/kb?assetCategory=${encodeURIComponent(asset.category)}`}
                    className="text-[11px] text-muted hover:text-ink"
                  >
                    知识库
                  </Link>
                </div>
                {knowledgeRows.length === 0 ? (
                  <p className="px-5 py-5 text-[12px] leading-relaxed text-muted">
                    还没有关联知识。可在知识库新建故障案例、维修方案或操作规程，并按设备类别复用。
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {knowledgeRows.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/app/kb/${item.id}`}
                          className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                        >
                          <Badge
                            tone={KB_CATEGORIES[item.category as KbCategory].tone}
                          >
                            {KB_CATEGORIES[item.category as KbCategory].label}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium">
                              {item.title}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">
                              {item.summary ?? "—"}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted">
                            {item.helpfulCount} 有用
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {repairable && (
                  <div className="border-t border-line px-5 py-3">
                    <Link
                      href="/app/kb/new"
                      className="text-[11px] text-muted transition-colors hover:text-ink"
                    >
                      + 为这台设备沉淀一条经验
                    </Link>
                  </div>
                )}
              </section>
            </>
          )}

          {currentTab === "profile" && (
            <section className="card p-5 lg:p-6">
              <SectionTitle title="技术参数与档案信息" />
              {manageable ? (
                <AssetProfileForm
                  asset={{
                    id: asset.id,
                    installLocation: asset.installLocation,
                    responsibleName: asset.responsibleName,
                    vendor: asset.vendor,
                    purchaseCost: asset.purchaseCost,
                    depreciationMonths: asset.depreciationMonths,
                    notes: asset.notes,
                  }}
                  specsText={specsToText(asset.specs)}
                />
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[12px]">
                  {Object.entries(asset.specs ?? {}).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-[11px] text-muted">{key}</dt>
                      <dd className="mt-1 font-medium">{value}</dd>
                    </div>
                  ))}
                  {!asset.specs && (
                    <p className="text-[12px] text-muted">还没有录入技术参数。</p>
                  )}
                </dl>
              )}
            </section>
          )}

          {currentTab === "docs" && (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                  <FileText className="size-4 text-muted" /> 图纸 / 说明书 / SOP / 验收资料
                </h2>
                <span className="label-mono">{docRows.length} FILES</span>
              </div>
              {docRows.length === 0 ? (
                <EmptyState
                  icon={<FileText className="size-7" />}
                  title="还没有上传文档"
                  hint="支持 PDF、Word、Excel、图片，单个不超过 20MB。"
                />
              ) : (
                <ul className="divide-y divide-line">
                  {docRows.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 px-5 py-3">
                      <FileText className="size-4 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium">{doc.name}</p>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {doc.category} · v{doc.version} · {fmtDate(doc.createdAt)}
                          {doc.fileName ? ` · ${doc.fileName}` : ""}
                        </p>
                      </div>
                      {doc.attachmentId && (
                        <a
                          href={`/api/files/${doc.attachmentId}`}
                          target="_blank"
                          className="text-[11px] text-muted hover:text-ink"
                        >
                          下载
                        </a>
                      )}
                      {manageable && (
                        <form action={deleteAssetDocument}>
                          <input type="hidden" name="id" value={doc.id} />
                          <input type="hidden" name="assetId" value={asset.id} />
                          <ConfirmSubmitButton
                            message={`删除文档「${doc.name}」？删除后不再显示在设备档案中。`}
                            iconOnly
                            ariaLabel="删除文档"
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
              {manageable && (
                <form
                  action={addAssetDocument}
                  className="grid gap-2 border-t border-line bg-paper/40 px-5 py-4 sm:grid-cols-[1fr_130px_1fr_auto]"
                >
                  <input type="hidden" name="assetId" value={asset.id} />
                  <Input name="name" placeholder="文档名称" required />
                  <Select name="category" defaultValue="manual">
                    <option value="manual">说明书</option>
                    <option value="drawing">图纸</option>
                    <option value="sop">SOP</option>
                    <option value="acceptance">验收资料</option>
                    <option value="certificate">合格证</option>
                    <option value="other">其他</option>
                  </Select>
                  <input
                    type="file"
                    name="file"
                    required
                    className="h-10 rounded-xl border border-line bg-surface px-2 text-[11px] file:mr-2 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1.5"
                  />
                  <SubmitButton size="sm" className="h-10">
                    上传
                  </SubmitButton>
                </form>
              )}
            </section>
          )}

          {currentTab === "parts" && (
            <>
              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <Package className="size-4 text-muted" /> 备件 BOM
                  </h2>
                  <span className="label-mono">{bomRows.length} PARTS</span>
                </div>
                {bomRows.length === 0 ? (
                  <EmptyState
                    icon={<Package className="size-7" />}
                    title="还没有关联备件"
                    hint="在备件详情页把常换件挂到这台设备上，领用时更快找到对应型号。"
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {bomRows.map((bom) => {
                      const low = bom.stockQty < bom.safetyStock;
                      return (
                        <li key={bom.id}>
                          <Link
                            href={`/app/spare-parts/${bom.partId}`}
                            className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-medium">
                                {bom.partName}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] text-muted">
                                {bom.partCode} · 单台用量 {bom.quantity} {bom.unit}
                                {bom.note ? ` · ${bom.note}` : ""}
                              </p>
                            </div>
                            <span className="text-[11px] text-muted">
                              库存{" "}
                              <span className={low ? "text-danger" : "text-ink"}>
                                {bom.stockQty}
                              </span>
                            </span>
                            <Badge tone={low ? "danger" : "mint"}>
                              {low ? "需补货" : "正常"}
                            </Badge>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="text-[13px] font-semibold">备件消耗成本</h2>
                  <span className="font-mono text-[11px] text-ink-soft">
                    ¥{partCostTotal.toFixed(2)}
                  </span>
                </div>
                {consumptionRows.length === 0 ? (
                  <p className="px-5 py-6 text-[12px] text-muted">
                    还没有备件消耗记录。工单领用后会自动归集到这里。
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {consumptionRows.map((row) => (
                      <li key={row.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium">
                            {row.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted">
                            {row.quantity} {row.unit || "件"} · {fmtDateTime(row.createdAt)}
                            {" · "}
                            <Link
                              href={`/app/work-orders/${row.workOrderId}`}
                              className="text-accent-ink hover:underline"
                            >
                              {row.workOrderCode}
                            </Link>
                          </p>
                        </div>
                        <span className="font-mono text-[11px] text-muted">
                          {row.amount
                            ? `¥${Number(row.amount).toFixed(2)}`
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <Package className="size-4 text-muted" /> 下级部件
                  </h2>
                  {manageable && (
                    <Link
                      href={`/admin/assets/new?parentId=${asset.id}&level=component`}
                      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
                    >
                      <Package className="size-3.5" /> 新增部件
                    </Link>
                  )}
                </div>
                {childRows.length === 0 ? (
                  <EmptyState
                    icon={<Package className="size-7" />}
                    title="还没有下级部件"
                    hint="把液压系统、电控柜、伺服电机等作为部件挂在设备下，形成完整结构。"
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {childRows.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/app/assets/${child.id}`}
                          className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                        >
                          <Badge tone={ASSET_LEVEL[child.level]?.tone ?? "neutral"}>
                            {ASSET_LEVEL[child.level]?.label ?? child.level}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium">{child.name}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-muted">
                              {child.code}
                            </p>
                          </div>
                          <Badge tone={ASSET_STATUS[child.status]?.tone ?? "neutral"}>
                            {ASSET_STATUS[child.status]?.label ?? child.status}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {currentTab === "workorders" && (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-[13px] font-semibold">维修与保养工单</h2>
                <span className="label-mono">{woRows.length} RECORDS</span>
              </div>
              {woRows.length === 0 ? (
                <EmptyState title="还没有工单" hint="扫码报修或新建工单后会出现在这里。" />
              ) : (
                <ul className="divide-y divide-line">
                  {woRows.map((wo) => (
                    <li key={wo.id}>
                      <Link
                        href={`/app/work-orders/${wo.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                      >
                        <Badge tone={WO_TYPE[wo.type]?.tone ?? "neutral"}>
                          {WO_TYPE[wo.type]?.label ?? wo.type}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium">{wo.title}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted">
                            {wo.code} · {fmtDateTime(wo.createdAt)}
                          </p>
                        </div>
                        <Badge tone={WO_STATUS[wo.status].tone}>
                          {WO_STATUS[wo.status].label}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {currentTab === "inspection" && (
            <>
              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <CalendarDots className="size-4 text-muted" /> PM / 点检计划
                  </h2>
                  <Link href="/app/inspection" className="text-[11px] text-muted hover:text-ink">
                    管理计划
                  </Link>
                </div>
                {planRows.length === 0 ? (
                  <EmptyState
                    icon={<CalendarDots className="size-7" />}
                    title="尚未配置计划"
                    hint="在保养模块为这台设备建立时间或计数触发的计划。"
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {planRows.map((plan) => (
                      <li key={plan.id} className="flex items-center gap-3 px-5 py-3.5">
                        <Badge tone={PLAN_TYPE[plan.type].tone}>
                          {PLAN_TYPE[plan.type].label}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium">{plan.name}</p>
                          <p className="mt-0.5 text-[10px] text-muted">
                            {PM_TRIGGER[plan.triggerType]?.label ?? plan.triggerType}
                            {plan.triggerType === "counter" && plan.counterType
                              ? ` · 每 ${plan.counterInterval} ${COUNTER_TYPE[plan.counterType]?.unit ?? ""}`
                              : ` · 每 ${plan.cycleDays} 天`}
                            {` · ${plan.templateName}`}
                          </p>
                        </div>
                        <span className="text-[11px] text-muted">
                          下次 {fmtDate(plan.nextDueAt)}
                        </span>
                        <Badge tone={plan.active ? "mint" : "neutral"}>
                          {plan.active ? "启用" : "停用"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card overflow-hidden">
                <div className="border-b border-line px-5 py-4">
                  <h2 className="text-[13px] font-semibold">最近点检任务</h2>
                </div>
                {taskRows.length === 0 ? (
                  <p className="px-5 py-6 text-[12px] text-muted">还没有点检任务。</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {taskRows.map((task) => (
                      <li key={task.id}>
                        <Link
                          href={`/app/inspection/tasks/${task.id}`}
                          className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium">
                              {task.templateName}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted">
                              到期 {fmtDate(task.dueAt)}
                            </p>
                          </div>
                          <Badge tone={TASK_STATUS[task.status].tone}>
                            {TASK_STATUS[task.status].label}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {pointRows.length > 0 && (
                <section className="card overflow-hidden">
                  <div className="border-b border-line px-5 py-4">
                    <h2 className="text-[13px] font-semibold">所属点检点位</h2>
                  </div>
                  <ul className="divide-y divide-line">
                    {pointRows.map((point) => (
                      <li key={point.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium">{point.name}</p>
                          <p className="mt-0.5 text-[10px] text-muted">
                            {point.routeName} · 标准{" "}
                            {point.standardMin ?? "—"} ~ {point.standardMax ?? "—"}{" "}
                            {point.unit ?? ""}
                          </p>
                        </div>
                        <Link
                          href={`/app/inspection/routes/${point.routeId}`}
                          className="text-[11px] text-muted hover:text-ink"
                        >
                          路线
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {currentTab === "history" && (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                  <ClockCounterClockwise className="size-4 text-muted" /> 状态履历
                </h2>
                <span className="label-mono">IMMUTABLE</span>
              </div>
              {statusHistory.length === 0 ? (
                <p className="px-5 py-6 text-[12px] text-muted">还没有状态变更记录。</p>
              ) : (
                <ol className="relative space-y-5 px-6 py-5">
                  {statusHistory.map((item, index) => (
                    <li
                      key={item.id}
                      className="relative border-l border-line pl-6 last:border-transparent"
                    >
                      <span
                        className={`absolute -left-[5px] top-1 size-2.5 rounded-full ${
                          index === 0 ? "bg-accent" : "bg-line"
                        }`}
                      />
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[12px] font-medium">
                          {item.fromStatus
                            ? `${ASSET_STATUS[item.fromStatus]?.label ?? item.fromStatus} → `
                            : ""}
                          {ASSET_STATUS[item.toStatus]?.label ?? item.toStatus}
                        </p>
                        <span className="font-mono text-[9px] text-muted">
                          {fmtDateTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {item.reason ?? "无备注"} · 来源 {item.source}
                      </p>
                      <p className="mt-1 text-[10px] text-muted/70">
                        操作人：{item.actorName ?? "系统"}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card sticky top-6 p-5 text-center">
            <p className="label-mono mb-3">现场点检 / 报修入口</p>
            <div className="mx-auto w-fit rounded-2xl border border-line p-3">
              <Image
                src={qr}
                alt={`${asset.name} 点检报修二维码`}
                width={190}
                height={190}
                unoptimized
              />
            </div>
            <p className="mt-4 text-[13px] font-medium">{asset.name}</p>
            <p className="mt-1 font-mono text-[10px] text-muted">
              {asset.code} · 扫码点检 / 报修
            </p>
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
            <SectionTitle title="状态管理" />
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">当前状态</span>
                <Badge tone={ASSET_STATUS[asset.status]?.tone ?? "neutral"} dot>
                  {ASSET_STATUS[asset.status]?.label ?? asset.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">层级</span>
                <span className="font-medium">
                  {ASSET_LEVEL[asset.level]?.label ?? asset.level}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">位置</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <MapPin className="size-3.5 text-muted" />
                  {row.locationName ?? "未分配"}
                </span>
              </div>
            </div>

            {manageable && (
              <form
                action={updateAssetStatus}
                className="mt-4 space-y-2 border-t border-line pt-4"
              >
                <input type="hidden" name="id" value={asset.id} />
                <select
                  name="status"
                  defaultValue={asset.status}
                  className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-[12px]"
                >
                  {Object.entries(ASSET_STATUS).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <input
                  name="reason"
                  placeholder="变更原因（故障必填）"
                  className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-[12px]"
                />
                <button
                  type="submit"
                  className="h-9 w-full rounded-full bg-ink px-3 text-[11px] font-medium text-white"
                >
                  更新状态并留痕
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
