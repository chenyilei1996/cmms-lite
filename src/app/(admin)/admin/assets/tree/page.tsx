import { ArrowElbowDownRight, ArrowLeft, ArrowsOutCardinal, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import {
  ASSET_LEVEL,
  ASSET_LEVEL_ORDER,
  ASSET_STATUS,
} from "@/lib/constants";
import { createAssetNode, moveAsset } from "@/server/asset-actions";
import {
  Badge,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

export const metadata = { title: "设备树" };

type Node = {
  id: string;
  code: string;
  name: string;
  level: string;
  parentId: string | null;
  status: string;
  responsibleName: string | null;
};

function TreeBranch({
  node,
  childrenMap,
  depth,
  canEdit,
}: {
  node: Node;
  childrenMap: Map<string | null, Node[]>;
  depth: number;
  canEdit: boolean;
}) {
  const children = childrenMap.get(node.id) ?? [];
  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-paper/70"
        style={{ paddingLeft: depth * 18 + 8 }}
      >
        <ArrowElbowDownRight className="size-3.5 shrink-0 text-muted/60" />
        <Badge tone={ASSET_LEVEL[node.level]?.tone ?? "neutral"}>
          {ASSET_LEVEL[node.level]?.label ?? node.level}
        </Badge>
        <Link
          href={`/app/assets/${node.id}`}
          className="min-w-0 flex-1 truncate text-[12px] font-medium hover:text-accent-ink"
        >
          {node.name}
        </Link>
        <span className="hidden font-mono text-[10px] text-muted sm:block">
          {node.code}
        </span>
        <Badge tone={ASSET_STATUS[node.status]?.tone ?? "neutral"}>
          {ASSET_STATUS[node.status]?.label ?? node.status}
        </Badge>
        {node.responsibleName && (
          <span className="hidden text-[10px] text-muted md:block">
            {node.responsibleName}
          </span>
        )}
        {canEdit && (
          <Link
            href={`/admin/assets/tree?move=${node.id}`}
            className="rounded-full p-1 text-muted opacity-0 transition-opacity hover:bg-surface hover:text-ink group-hover:opacity-100"
            aria-label="移动节点"
          >
            <ArrowsOutCardinal className="size-3.5" />
          </Link>
        )}
      </div>
      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              childrenMap={childrenMap}
              depth={depth + 1}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function AssetTreePage({
  searchParams,
}: {
  searchParams: Promise<{ move?: string }>;
}) {
  const { move } = await searchParams;
  const user = await requireUser();
  const canEdit = canManage(user.role);

  const rows = await db
    .select({
      id: assets.id,
      code: assets.code,
      name: assets.name,
      level: assets.level,
      parentId: assets.parentId,
      status: assets.status,
      responsibleName: assets.responsibleName,
    })
    .from(assets)
    .orderBy(asc(assets.code));

  const [moving] = move
    ? await db
        .select({
          id: assets.id,
          name: assets.name,
          level: assets.level,
          parentId: assets.parentId,
        })
        .from(assets)
        .where(eq(assets.id, move))
        .limit(1)
    : [];

  const idSet = new Set(rows.map((row) => row.id));
  const byParent = new Map<string | null, Node[]>();
  for (const row of rows) {
    const key = row.parentId && idSet.has(row.parentId) ? row.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }
  const roots = byParent.get(null) ?? [];
  const levelCount = ASSET_LEVEL_ORDER.map((level) => ({
    level,
    count: rows.filter((row) => row.level === level).length,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Asset hierarchy"
        title="设备树"
        description="工厂 → 车间 → 产线 → 单机 → 部件。层级移动会写入审计，部件可直接挂在一机一档下。"
        actions={
          <>
            <LinkButton href="/app/assets" variant="secondary">
              <ArrowLeft className="size-4" /> 台账
            </LinkButton>
            <LinkButton href="/admin/assets/new" variant="secondary">
              <Plus className="size-4" /> 完整建档
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {levelCount.map((item) => (
          <div key={item.level} className="card px-3 py-3">
            <p className="text-[10px] text-muted">
              {ASSET_LEVEL[item.level].label}
            </p>
            <p className="mt-1 font-mono text-[20px] tabular-nums">{item.count}</p>
          </div>
        ))}
      </div>

      {moving && canEdit && (
        <section className="card mb-4 p-5">
          <h2 className="text-[13px] font-semibold">
            移动「{moving.name}」
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            不能移动到自身或自己的子节点下。移动原因会进入审计日志。
          </p>
          <form action={moveAsset} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input type="hidden" name="id" value={moving.id} />
            <Select name="parentId" defaultValue={moving.parentId ?? ""}>
              <option value="">移到根节点</option>
              {rows
                .filter((row) => row.id !== moving.id)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {ASSET_LEVEL[row.level]?.label} · {row.code} {row.name}
                  </option>
                ))}
            </Select>
            <Input name="reason" placeholder="移动原因（如 产线调整）" />
            <SubmitButton>确认移动</SubmitButton>
            <Link
              href="/admin/assets/tree"
              className="flex h-10 items-center justify-center rounded-full border border-line px-4 text-[12px] text-muted"
            >
              取消
            </Link>
          </form>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">层级结构</h2>
            <span className="label-mono">{rows.length} NODES</span>
          </div>
          {roots.length === 0 ? (
            <EmptyState
              title="还没有层级节点"
              hint="先建一个工厂节点，再逐级往下挂车间、产线和设备。"
            />
          ) : (
            <ul className="py-2">
              {roots.map((node) => (
                <TreeBranch
                  key={node.id}
                  node={node}
                  childrenMap={byParent}
                  depth={0}
                  canEdit={canEdit}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-[13px] font-semibold">快速新增节点</h2>
          <p className="mt-1 text-[11px] text-muted">
            适合先搭层级骨架；设备铭牌、参数和文档请用「完整建档」。
          </p>
          <form action={createAssetNode} className="mt-4 space-y-3">
            <Field label="节点名称" required>
              <Input name="name" placeholder="如 一号车间 / A 线 / 液压系统" required />
            </Field>
            <Field label="编码" required hint="唯一">
              <Input name="code" placeholder="如 WS-01" required />
            </Field>
            <Field label="层级">
              <Select name="level" defaultValue="workshop">
                {ASSET_LEVEL_ORDER.map((level) => (
                  <option key={level} value={level}>
                    {ASSET_LEVEL[level].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="上级节点">
              <Select name="parentId" defaultValue="">
                <option value="">根节点</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {ASSET_LEVEL[row.level]?.label} · {row.code} {row.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="负责人">
              <Input name="responsibleName" placeholder="选填" />
            </Field>
            <SubmitButton className="w-full">新增节点</SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}
