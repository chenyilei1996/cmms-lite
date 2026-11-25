import {
  Check,
  Minus,
  Plus,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { Fragment } from "react";
import { redirect } from "next/navigation";

import { isAdmin, requireUser } from "@/lib/auth";
import {
  CAPABILITY_GROUPS,
  CAPS_HINT,
  roleHasLevel,
  type RoleCaps,
} from "@/lib/permissions";
import { listRoles } from "@/lib/roles";
import {
  Badge,
  Field,
  Input,
  LinkButton,
  PageHeader,
  SectionTitle,
  Select,
  Textarea,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";
import { createRole, deleteRole, saveRole } from "@/server/role-actions";

export const metadata = { title: "角色权限" };

const ERRORS: Record<string, string> = {
  forbidden: "只有具备系统管理能力的角色可以修改角色权限。",
  fields: "请填写角色名称，且长度不超过限制。",
  duplicate: "已存在同名角色，请换一个名称。",
  missing: "角色不存在或已被删除。",
  builtin: "内置角色不能删除，可以修改名称与能力。",
  "in-use": "该角色仍有用户在使用，请先调整这些用户的角色。",
  "last-admin": "系统必须保留至少一个具备系统管理能力的启用账号。",
};

const OKS: Record<string, string> = {
  created: "角色已创建，可在用户管理中分配。",
  updated: "角色权限已保存，用户下一次请求立即生效。",
  deleted: "角色已删除。",
};

const TONE_OPTIONS: { value: string; label: string }[] = [
  { value: "ink", label: "深墨" },
  { value: "accent", label: "主色蓝" },
  { value: "mint", label: "薄荷绿" },
  { value: "honey", label: "琥珀黄" },
  { value: "neutral", label: "中性灰" },
  { value: "danger", label: "警示红" },
];

const CAP_KEYS = ["manage", "repair", "admin"] as const;

function capsSummary(caps: RoleCaps) {
  if (caps.admin) return "系统管理 · 管理级 · 执行级";
  if (caps.manage) return "管理级 · 执行级";
  if (caps.repair) return "执行级";
  return "只读查看";
}

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/admin/settings");

  const roleRows = await listRoles();

  return (
    <>
      <PageHeader
        eyebrow="Access · roles"
        title="角色权限"
        description="角色可自行新增、改名或删除，并按三档能力授权：执行级、管理级、系统管理（高级别自动包含低级别）。权限矩阵随之自动展开，无法单独勾选。"
        actions={
          <LinkButton href="/admin/settings" variant="secondary">
            <ShieldCheck className="size-4" /> 返回设置
          </LinkButton>
        }
      />

      {sp.ok && OKS[sp.ok] && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          {OKS[sp.ok]}
        </p>
      )}
      {sp.error && ERRORS[sp.error] && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          {ERRORS[sp.error]}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roleRows.map((role) => (
          <section
            key={role.id}
            className={`card p-4 ${
              role.id === user.role ? "ring-1 ring-accent/40" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Badge tone={role.tone}>{role.name}</Badge>
              <div className="flex items-center gap-1.5">
                {role.builtin && (
                  <span className="label-mono text-[9px] text-muted">
                    BUILTIN
                  </span>
                )}
                {role.id === user.role && (
                  <span className="text-[9px] text-accent-ink">当前角色</span>
                )}
              </div>
            </div>

            <p className="mt-2.5 text-[10px] leading-relaxed text-muted">
              {role.description || "未填写角色说明"}
            </p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">
              {capsSummary({
                manage: role.manage,
                repair: role.repair,
                admin: role.admin,
              })}
            </p>

            <details className="mt-3 border-t border-line pt-3">
              <summary className="cursor-pointer text-[11px] font-medium text-ink-soft">
                编辑名称与能力
              </summary>
              <form action={saveRole} className="mt-3 space-y-2.5">
                <input type="hidden" name="id" value={role.id} />
                <Field label="角色名称" required hint="不超过 12 字">
                  <Input
                    name="name"
                    defaultValue={role.name}
                    required
                    maxLength={12}
                  />
                </Field>
                <Field label="角色说明" hint="展示在用户列表与权限页">
                  <Textarea
                    name="description"
                    defaultValue={role.description}
                    maxLength={60}
                    rows={2}
                  />
                </Field>
                <Field label="标签色">
                  <Select name="tone" defaultValue={role.tone}>
                    {TONE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="space-y-1.5 rounded-xl bg-paper/70 px-3 py-2.5">
                  {CAP_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-start gap-2 text-[11px] text-ink-soft"
                    >
                      <input
                        type="checkbox"
                        name={key}
                        defaultChecked={role[key]}
                        disabled={role.id === "admin" && key !== "admin"}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium">
                          {key === "manage"
                            ? "管理级"
                            : key === "repair"
                              ? "执行级"
                              : "系统管理"}
                        </span>
                        <span className="block text-[10px] text-muted">
                          {CAPS_HINT[key]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <SubmitButton size="sm">保存角色</SubmitButton>
              </form>

              {!role.builtin && (
                <form action={deleteRole} className="mt-2">
                  <input type="hidden" name="id" value={role.id} />
                  <ConfirmSubmitButton
                    message={`删除角色「${role.name}」？若有用户正在使用将无法删除。`}
                    className="text-[11px] text-danger hover:underline"
                  >
                    <Trash className="size-3.5" /> 删除角色
                  </ConfirmSubmitButton>
                </form>
              )}
            </details>
          </section>
        ))}
      </div>

      <section className="card mt-4 p-5">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
            <Plus className="size-4 text-muted" /> 新增角色
          </summary>
          <form
            action={createRole}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Field label="角色名称" required hint="不超过 12 字">
              <Input name="name" placeholder="如：电气工程师" required maxLength={12} />
            </Field>
            <Field label="标签色">
              <Select name="tone" defaultValue="neutral">
                {TONE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="角色说明">
              <Input name="description" maxLength={60} placeholder="一句话描述职责" />
            </Field>
            <div className="space-y-1.5 rounded-xl bg-paper/70 px-3 py-2.5 sm:col-span-2 lg:col-span-3">
              {CAP_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-start gap-2 text-[11px] text-ink-soft"
                >
                  <input type="checkbox" name={key} className="mt-0.5" />
                  <span>
                    <span className="font-medium">
                      {key === "manage"
                        ? "管理级"
                        : key === "repair"
                          ? "执行级"
                          : "系统管理"}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {CAPS_HINT[key]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="lg:col-span-3">
              <SubmitButton>创建角色</SubmitButton>
            </div>
          </form>
        </details>
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionTitle
            title="权限矩阵"
            extra={<span className="label-mono">AUTO</span>}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-line bg-paper/60 text-left">
                <th className="px-5 py-3 font-medium text-muted">能力</th>
                {roleRows.map((role) => (
                  <th
                    key={role.id}
                    className="px-3 py-3 text-center font-medium text-muted"
                  >
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_GROUPS.map((group) => (
                <Fragment key={group.group}>
                  <tr className="bg-paper/40">
                    <td
                      colSpan={roleRows.length + 1}
                      className="px-5 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted"
                    >
                      {group.group}
                    </td>
                  </tr>
                  {group.items.map((item) => (
                    <tr
                      key={`${group.group}-${item.label}`}
                      className="border-b border-line/70 last:border-0"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink-soft">{item.label}</p>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {item.detail}
                        </p>
                      </td>
                      {roleRows.map((role) => (
                        <td key={role.id} className="px-3 py-3 text-center">
                          {roleHasLevel(
                            {
                              manage: role.manage,
                              repair: role.repair,
                              admin: role.admin,
                            },
                            item.level,
                          ) ? (
                            <Check className="mx-auto size-4 text-mint" />
                          ) : (
                            <Minus className="mx-auto size-3.5 text-muted/50" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-[10px] leading-relaxed text-muted">
          三档能力互相包含：系统管理 ⊃ 管理级 ⊃ 执行级。修改角色能力后，该角色下的账号在下一次请求时立即按新权限生效。
          内置「系统管理员」角色必须保留系统管理能力。
        </p>
      </section>
    </>
  );
}
