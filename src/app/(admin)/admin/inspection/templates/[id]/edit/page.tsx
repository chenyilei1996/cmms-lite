import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inspectionTemplates } from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { LinkButton, PageHeader } from "@/components/ui";
import { TemplateForm } from "../../template-form";

export const metadata = { title: "编辑检查模板" };

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [template] = await db
    .select()
    .from(inspectionTemplates)
    .where(eq(inspectionTemplates.id, id))
    .limit(1);

  if (!template) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Inspection templates"
        title="编辑检查模板"
        description={`${template.category} · 已被引用的计划会继续使用当前模板内容。`}
        actions={
          <LinkButton href="/admin/inspection" variant="secondary">
            <ArrowLeft className="size-4" /> 返回模板
          </LinkButton>
        }
      />
      {canRepair(user.role) ? (
        <TemplateForm
          initial={{
            id: template.id,
            name: template.name,
            category: template.category,
            items: template.items,
          }}
          submitLabel="保存修改"
        />
      ) : (
        <div className="card p-6 text-[13px] text-muted">
          当前角色没有编辑模板的权限。
        </div>
      )}
    </>
  );
}
