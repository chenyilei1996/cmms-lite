import { GearSix, Key, SignOut } from "@phosphor-icons/react/dist/ssr";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { roleHintOf, roleNameOf, roleToneOf } from "@/lib/roles";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  buttonClass,
  Field,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui-client";
import { logoutAction } from "@/server/auth-actions";
import { changePassword, updateProfile } from "@/server/user-actions";

export const metadata = { title: "个人资料" };

const ERRORS: Record<string, string> = {
  fields: "显示名称不能为空。",
  "password-fields": "请填写当前密码、新密码和确认密码。",
  "password-length": "新密码至少 8 位。",
  "password-match": "两次输入的新密码不一致。",
  "password-current": "当前密码不正确。",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireUser();
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!row) return null;

  return (
    <>
      <PageHeader
        eyebrow="Account · profile & password"
        title="个人资料"
        description="修改显示名称和登录密码。名称变更会同步到顶部导航与操作记录，角色与账号状态由管理员维护。"
        actions={
          <LinkButton href="/app/dashboard" variant="secondary">
            <GearSix className="size-4" /> 返回工作台
          </LinkButton>
        }
      />

      {sp.ok === "profile" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          显示名称已更新。
        </p>
      )}
      {sp.ok === "password" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          密码已修改，下次登录请使用新密码。
        </p>
      )}
      {sp.error && ERRORS[sp.error] && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          {ERRORS[sp.error]}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-[13px] font-semibold">账号信息</h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-accent text-[18px] font-semibold text-white">
                {row.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{row.name}</p>
                <p className="truncate font-mono text-[10px] text-muted">
                  {row.email}
                </p>
              </div>
              <Badge tone={roleToneOf(row.role)} className="ml-auto">
                {roleNameOf(row.role)}
              </Badge>
            </div>
            <p className="mt-3 rounded-xl bg-paper/70 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
              {roleHintOf(row.role)}
            </p>
            <dl className="mt-3 space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">最近登录</dt>
                <dd className="font-mono text-[10px] text-ink-soft">
                  {row.lastLoginAt ? fmtDateTime(row.lastLoginAt) : "本次首次登录"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">账号创建</dt>
                <dd className="font-mono text-[10px] text-ink-soft">
                  {fmtDateTime(row.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-[13px] font-semibold">基本信息</h2>
            <form action={updateProfile} className="mt-4 space-y-3">
              <Field label="显示名称" required hint="用于工单签名与操作记录">
                <Input name="name" defaultValue={row.name} required maxLength={30} />
              </Field>
              <Field label="登录邮箱" hint="如需变更请联系系统管理员">
                <Input value={row.email} disabled readOnly />
              </Field>
              <Field label="角色" hint="由管理员维护">
                <Input value={roleNameOf(row.role)} disabled readOnly />
              </Field>
              <SubmitButton>保存资料</SubmitButton>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="text-[13px] font-semibold">退出登录</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              在公用电脑或手机使用完后，建议立即退出，避免他人以你的身份查看或操作。
            </p>
            <form action={logoutAction} className="mt-3">
              <ConfirmSubmitButton
                message="确认退出登录？退出后需要重新输入账号密码。"
                pendingText="正在退出…"
                className={buttonClass("secondary", "md")}
              >
                <SignOut className="size-4" /> 退出登录
              </ConfirmSubmitButton>
            </form>
          </section>
        </div>

        <section className="card h-fit p-5">
          <div className="flex items-center gap-2">
            <Key className="size-4 text-accent" />
            <h2 className="text-[13px] font-semibold">修改密码</h2>
          </div>
          <form action={changePassword} className="mt-4 space-y-3">
            <Field label="当前密码" required>
              <Input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="新密码" required hint="至少 8 位">
              <Input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field label="确认新密码" required>
              <Input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <SubmitButton variant="secondary">更新密码</SubmitButton>
          </form>
          <p className="mt-4 rounded-xl bg-paper/70 px-3 py-2.5 text-[10px] leading-relaxed text-muted">
            密码使用 bcrypt 哈希存储，系统不会展示或找回明文。管理员重置密码后，
            请使用新密码重新登录。
          </p>
        </section>
      </div>
    </>
  );
}
