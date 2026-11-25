import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  inspectionTemplates,
  maintenancePlans,
  users,
} from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { LinkButton, PageHeader } from "@/components/ui";
import { PlanForm } from "../../new/plan-form";

export const metadata = { title: "编辑保养计划" };

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [plan] = await db
    .select()
    .from(maintenancePlans)
    .where(eq(maintenancePlans.id, id))
    .limit(1);

  if (!plan) notFound();

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
        title="编辑巡检 / 保养计划"
        description={`当前计划：${plan.name} · 下次到期 ${
          plan.nextDueAt.toISOString().slice(0, 10)
        }`}
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
          initial={{
            id: plan.id,
            name: plan.name,
            assetId: plan.assetId,
            templateId: plan.templateId,
            type: plan.type,
            triggerType: plan.triggerType,
            counterType: plan.counterType,
            counterInterval: plan.counterInterval,
            cycleDays: plan.cycleDays,
            nextDueAt: plan.nextDueAt.toISOString().slice(0, 10),
            assigneeId: plan.assigneeId,
            standardMinutes: plan.standardMinutes,
            safetyNotes: plan.safetyNotes,
            requiredTools: plan.requiredTools,
          }}
          submitLabel="保存修改"
        />
      ) : (
        <div className="card p-6 text-[13px] text-muted">
          当前角色没有编辑计划的权限。
        </div>
      )}
    </>
  );
}
