import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assets, inspectionTemplates, users } from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { LinkButton, PageHeader } from "@/components/ui";
import { PlanForm } from "./plan-form";

export const metadata = { title: "新建保养计划" };

export default async function NewPlanPage() {
  const user = await requireUser();
  const [assetRows, templateRows, assigneeRows] = await Promise.all([
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .orderBy(asc(assets.code)),
    db
      .select({
        id: inspectionTemplates.id,
        name: inspectionTemplates.name,
        category: inspectionTemplates.category,
      })
      .from(inspectionTemplates)
      .orderBy(asc(inspectionTemplates.name)),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.role, ["technician", "manager"]))
      .orderBy(asc(users.name)),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow="Preventive maintenance"
        title="新建巡检 / 保养计划"
        description="计划到期后会自动生成任务；同一计划不会重复生成未完成任务。"
        actions={
          <LinkButton href="/admin/inspection" variant="secondary">
            <ArrowLeft className="size-4" /> 返回计划
          </LinkButton>
        }
      />
      {canRepair(user.role) ? (
        <PlanForm
          assets={assetRows}
          templates={templateRows}
          assignees={assigneeRows}
          today={today}
        />
      ) : (
        <div className="card p-6 text-[13px] text-muted">
          当前角色没有创建计划的权限。
        </div>
      )}
    </>
  );
}
