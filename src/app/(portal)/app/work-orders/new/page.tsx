import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assets, users } from "@/db/schema";
import { canRepair, requireUser } from "@/lib/auth";
import { LinkButton, PageHeader } from "@/components/ui";
import { WorkOrderForm } from "./work-order-form";

export const metadata = { title: "新建工单" };

export default async function NewWorkOrderPage() {
  const user = await requireUser();
  const [assetRows, assigneeRows] = await Promise.all([
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .orderBy(asc(assets.code)),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.role, ["technician", "manager"]))
      .orderBy(asc(users.name)),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Maintenance workflow"
        title="新建工单"
        description="手动建单适合巡检发现的异常或计划外维修。扫码报修会自动生成工单。"
        actions={
          <LinkButton href="/app/work-orders" variant="secondary">
            <ArrowLeft className="size-4" /> 返回看板
          </LinkButton>
        }
      />
      {canRepair(user.role) ? (
        <WorkOrderForm assets={assetRows} assignees={assigneeRows} />
      ) : (
        <div className="card p-6 text-[13px] text-muted">
          当前角色没有创建工单的权限。
        </div>
      )}
    </>
  );
}
