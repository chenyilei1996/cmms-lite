import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { canRepair, requireUser } from "@/lib/auth";
import { LinkButton, PageHeader } from "@/components/ui";
import { TemplateForm } from "../template-form";

export const metadata = { title: "新建检查模板" };

export default async function NewTemplatePage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        eyebrow="Inspection templates"
        title="新建检查模板"
        description="把常用检查项固化成模板，计划引用模板后会自动生成点检任务。"
        actions={
          <LinkButton href="/admin/inspection" variant="secondary">
            <ArrowLeft className="size-4" /> 返回模板
          </LinkButton>
        }
      />
      {canRepair(user.role) ? (
        <TemplateForm />
      ) : (
        <div className="card p-6 text-[13px] text-muted">
          当前角色没有创建模板的权限。
        </div>
      )}
    </>
  );
}
