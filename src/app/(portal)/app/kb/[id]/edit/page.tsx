import { ArrowLeft, ClipboardText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, faultCodes, kbArticles, workOrders } from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { LinkButton, PageHeader } from "@/components/ui";
import { updateKbArticle } from "@/server/kb-actions";
import { KbForm } from "../../kb-form";

export const metadata = { title: "编辑知识" };

export default async function EditKnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canRepair(user.role)) redirect(`/app/kb/${id}`);

  const manageable = canManage(user.role);
  const [row] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, id))
    .limit(1);
  if (!row) notFound();
  if (row.status === "archived" && !manageable) redirect(`/app/kb/${id}`);

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
    row.sourceWorkOrderId
      ? db
          .select({ id: workOrders.id, code: workOrders.code, title: workOrders.title })
          .from(workOrders)
          .where(eq(workOrders.id, row.sourceWorkOrderId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const source = sourceRow[0];

  return (
    <>
      <PageHeader
        eyebrow={`${row.code} · 编辑`}
        title={row.title}
        description="修改后立即生效；发布与归档权限仅限维修主管与系统管理员。"
        actions={
          <LinkButton href={`/app/kb/${row.id}`} variant="secondary">
            <ArrowLeft className="size-4" /> 返回详情
          </LinkButton>
        }
      />

      {source && (
        <Link
          href={`/app/work-orders/${source.id}`}
          className="card mb-4 flex items-center gap-3 p-4 transition-colors hover:border-ink/25"
        >
          <ClipboardText className="size-4 text-muted" />
          <p className="text-[12px] text-ink-soft">
            来源工单 {source.code} · {source.title}
          </p>
        </Link>
      )}

      <KbForm
        action={updateKbArticle}
        mode="edit"
        canPublish={manageable}
        assets={assetRows.map((item) => ({
          id: item.id,
          label: `${item.code} · ${item.name}`,
        }))}
        faultCodes={faultCodeRows.map((item) => ({
          id: item.id,
          label: `${item.code} · ${item.name}`,
        }))}
        article={{
          id: row.id,
          title: row.title,
          summary: row.summary,
          category: row.category,
          content: row.content,
          assetId: row.assetId,
          assetCategory: row.assetCategory,
          faultCodeId: row.faultCodeId,
          tags: row.tags,
          status: row.status,
        }}
      />
    </>
  );
}
