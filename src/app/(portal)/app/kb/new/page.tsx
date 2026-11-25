import { ArrowLeft, ClipboardText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, faultCodes, workOrders } from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { createKbArticle } from "@/server/kb-actions";
import { KbForm } from "../kb-form";

export const metadata = { title: "新建知识" };

export default async function NewKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ workOrderId?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  if (!canRepair(user.role)) redirect("/app/kb");

  const [assetRows, faultCodeRows, sourceRow] = await Promise.all([
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .where(eq(assets.level, "machine"))
      .orderBy(asc(assets.code)),
    db
      .select({ id: faultCodes.id, code: faultCodes.code, name: faultCodes.name })
      .from(faultCodes)
      .where(eq(faultCodes.active, true))
      .orderBy(asc(faultCodes.code)),
    sp.workOrderId
      ? db
          .select({
            id: workOrders.id,
            code: workOrders.code,
            title: workOrders.title,
            faultPhenomenon: workOrders.faultPhenomenon,
            faultCause: workOrders.faultCause,
            countermeasure: workOrders.countermeasure,
            resolution: workOrders.resolution,
            assetId: workOrders.assetId,
            assetName: assets.name,
            assetCategory: assets.category,
            faultCodeId: workOrders.faultCodeId,
          })
          .from(workOrders)
          .innerJoin(assets, eq(workOrders.assetId, assets.id))
          .where(eq(workOrders.id, sp.workOrderId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const source = sourceRow[0];
  const defaultTitle = source ? `${source.title} · 处理经验` : undefined;
  const defaultContent = source
    ? [
        "## 故障现象",
        source.faultPhenomenon ?? "（补充现场观察到的现象）",
        "",
        "## 原因分析",
        source.faultCause ?? "（补充确认的原因）",
        "",
        "## 处理步骤",
        "1. ",
        "",
        "## 处理结果",
        source.resolution ?? source.countermeasure ?? "（补充处理结果与验证方式）",
        "",
        "## 预防建议",
        "- ",
      ].join("\n")
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Knowledge base · New"
        title="新建知识"
        description="沉淀一条可复用的现场经验。草稿仅自己与主管可见，发布后全员可检索。"
        actions={
          <LinkButton href="/app/kb" variant="secondary">
            <ArrowLeft className="size-4" /> 返回知识库
          </LinkButton>
        }
      />

      {sp.error === "fields" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          标题和正文不能为空，请补充后再保存。
        </p>
      )}

      {source && (
        <section className="card mb-4 p-4">
          <SectionTitle
            title="来源工单"
            extra={<ClipboardText className="size-4 text-muted" />}
          />
          <Link
            href={`/app/work-orders/${source.id}`}
            className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-ink/25"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-paper font-mono text-[10px] text-muted">
              WO
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium">
                {source.code} · {source.title}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                已带入现象、原因与处理结果，可直接补充成知识。
              </p>
            </div>
          </Link>
        </section>
      )}

      <KbForm
        action={createKbArticle}
        mode="create"
        canPublish={canManage(user.role)}
        assets={assetRows.map((row) => ({
          id: row.id,
          label: `${row.code} · ${row.name}`,
        }))}
        faultCodes={faultCodeRows.map((row) => ({
          id: row.id,
          label: `${row.code} · ${row.name}`,
        }))}
        sourceWorkOrderId={source?.id ?? null}
        defaultTitle={defaultTitle}
        defaultContent={defaultContent}
        submitted={
          source
            ? {
                title: defaultTitle,
                category: "fault_case",
                content: defaultContent,
                assetId: source.assetId,
                assetCategory: source.assetCategory,
                faultCodeId: source.faultCodeId ?? undefined,
                tags: source.assetName,
              }
            : undefined
        }
      />
    </>
  );
}
