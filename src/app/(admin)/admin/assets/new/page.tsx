import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { assets, locations } from "@/db/schema";
import { requireUser, canManage } from "@/lib/auth";
import { PageHeader, LinkButton } from "@/components/ui";
import { AssetForm } from "./asset-form";

export const metadata = { title: "新增设备" };

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string; level?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const [locationRows, parentRows] = await Promise.all([
    db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .orderBy(asc(locations.sort)),
    db
      .select({
        id: assets.id,
        code: assets.code,
        name: assets.name,
        level: assets.level,
      })
      .from(assets)
      .orderBy(asc(assets.code)),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Asset registry"
        title={sp.parentId ? "新增子节点" : "新增设备"}
        description="保存后会自动生成一个不可猜测的二维码令牌，标签可直接打印。"
        actions={
          <LinkButton href="/app/assets" variant="secondary">
            <ArrowLeft className="size-4" /> 返回台账
          </LinkButton>
        }
      />
      {canManage(user.role) ? (
        <AssetForm
          locations={locationRows}
          parents={parentRows}
          initialParentId={sp.parentId ?? ""}
          initialLevel={sp.level ?? "machine"}
        />
      ) : (
        <div className="card p-6 text-[13px] text-muted">
          当前角色没有新增设备的权限，请联系系统管理员或维修主管。
        </div>
      )}
    </>
  );
}
