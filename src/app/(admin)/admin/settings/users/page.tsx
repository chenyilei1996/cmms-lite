import { Key, Plus, ShieldCheck, Users } from "@phosphor-icons/react/dist/ssr";
import { asc } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { isAdmin, requireUser } from "@/lib/auth";
import { listRoles, roleHintOf, roleNameOf, roleToneOf } from "@/lib/roles";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import {
  createUser,
  resetUserPassword,
  updateUser,
} from "@/server/user-actions";
import { redirect } from "next/navigation";

export const metadata = { title: "用户管理" };

const ERRORS: Record<string, string> = {
  forbidden: "只有系统管理员可以管理用户。",
  fields: "请填写完整的用户信息。",
  email: "邮箱格式不正确。",
  password: "密码至少 8 位。",
  duplicate: "该邮箱已被其他账号使用。",
  missing: "用户不存在或已被删除。",
  self: "不能在这里修改自己的账号，请到个人资料操作。",
  "last-admin": "至少保留一个启用的系统管理员账号。",
  role: "角色不合法。",
};

const OKS: Record<string, string> = {
  created: "用户已创建，可立即使用邮箱和密码登录。",
  updated: "用户信息已更新。",
  activated: "账号已启用。",
  deactivated: "账号已停用，下一次请求立即失效。",
  password: "密码已重置，请通知用户使用新密码登录。",
};

export default async function UsersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/admin/settings");

  const roleOptions = await listRoles();
  const list = await db
    .select()
    .from(users)
    .orderBy(asc(users.role), asc(users.name));

  const activeCount = list.filter((item) => item.active).length;
  const adminRoleIds = new Set(
    roleOptions.filter((item) => item.admin).map((item) => item.id),
  );
  const adminCount = list.filter(
    (item) => item.active && adminRoleIds.has(item.role),
  ).length;
  const inactiveCount = list.length - activeCount;

  return (
    <>
      <PageHeader
        eyebrow="Access · users"
        title="用户管理"
        description="新增账号、调整角色、停用账号或重置密码。修改会在用户下一次请求时立即生效，无需等待登录过期。"
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

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="账号总数"
          value={list.length}
          tone="accent"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="启用账号"
          value={activeCount}
          tone="mint"
          sub="可正常登录"
        />
        <StatCard
          label="停用账号"
          value={inactiveCount}
          tone="neutral"
          sub="保留历史记录"
        />
        <StatCard
          label="启用管理员"
          value={adminCount}
          tone="ink"
          sub="至少保留 1 个"
        />
      </div>

      <section className="card mb-4 p-5">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
            <Plus className="size-4 text-muted" /> 新增用户
          </summary>
          <form
            action={createUser}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field label="姓名" required>
              <Input name="name" placeholder="维修人员姓名" required maxLength={30} />
            </Field>
            <Field label="登录邮箱" required>
              <Input
                name="email"
                type="email"
                placeholder="name@cmms.local"
                required
              />
            </Field>
            <Field label="初始密码" required hint="至少 8 位">
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field label="角色" required>
              <Select name="role" defaultValue="technician">
                {roleOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-4">
              <SubmitButton>创建用户</SubmitButton>
            </div>
          </form>
        </details>
      </section>

      {list.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="还没有用户"
          hint="先创建一个管理员或维修人员账号。"
        />
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const self = item.id === user.id;
            return (
              <section key={item.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white ${
                        item.active ? "bg-accent" : "bg-muted"
                      }`}
                    >
                      {item.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold">{item.name}</p>
                        <Badge tone={roleToneOf(item.role)}>
                          {roleNameOf(item.role)}
                        </Badge>
                        <Badge tone={item.active ? "mint" : "neutral"}>
                          {item.active ? "启用" : "停用"}
                        </Badge>
                        {self && <Badge tone="honey">当前账号</Badge>}
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-muted">
                        {item.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-muted">
                    <p>
                      最近登录{" "}
                      {item.lastLoginAt ? fmtDateTime(item.lastLoginAt) : "从未登录"}
                    </p>
                    <p className="mt-0.5">创建于 {fmtDateTime(item.createdAt)}</p>
                  </div>
                </div>

                <p className="mt-2.5 text-[10px] text-muted">
                  {roleHintOf(item.role)}
                </p>

                {self ? (
                  <p className="mt-3 border-t border-line pt-3 text-[11px] text-muted">
                    当前账号请到{" "}
                    <a
                      href="/app/profile"
                      className="text-accent-ink underline-offset-2 hover:underline"
                    >
                      个人资料
                    </a>{" "}
                    修改名称或密码。
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 border-t border-line pt-3 lg:grid-cols-2">
                    <details>
                      <summary className="cursor-pointer text-[11px] font-medium text-ink-soft">
                        编辑姓名 / 角色 / 状态
                      </summary>
                      <form
                        action={updateUser}
                        className="mt-2 grid gap-2 sm:grid-cols-2"
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <Field label="姓名">
                          <Input
                            name="name"
                            defaultValue={item.name}
                            required
                            maxLength={30}
                          />
                        </Field>
                        <Field label="角色">
                          <Select name="role" defaultValue={item.role}>
                            {roleOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <label className="flex items-center gap-2 text-[11px] text-ink-soft sm:col-span-2">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={item.active}
                          />
                          启用该账号
                        </label>
                        <div className="sm:col-span-2">
                          <SubmitButton size="sm">保存修改</SubmitButton>
                        </div>
                      </form>
                    </details>

                    <details>
                      <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-ink-soft">
                        <Key className="size-3.5" /> 重置密码
                      </summary>
                      <form action={resetUserPassword} className="mt-2 space-y-2">
                        <input type="hidden" name="id" value={item.id} />
                        <Field label="新密码" hint="至少 8 位">
                          <Input
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                          />
                        </Field>
                        <SubmitButton size="sm" variant="secondary">
                          确认重置
                        </SubmitButton>
                      </form>
                    </details>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
