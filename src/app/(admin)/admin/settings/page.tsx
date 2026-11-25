import { ClockCounterClockwise, GearSix, ShieldCheck, Sparkle, Users } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, count, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { canManage, isAdmin, requireUser } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai-config";
import {
  listRoles,
  roleHintOf,
  roleNameOf,
  roleToneOf,
} from "@/lib/roles";
import {
  Badge,
  ChevronRight,
  LinkButton,
  PageHeader,
} from "@/components/ui";

export const metadata = { title: "系统设置" };

export default async function SettingsPage() {
  const user = await requireUser();
  const admin = isAdmin(user.role);
  const manager = canManage(user.role);

  const [userStats, auditStats] = await Promise.all([
    admin
      ? db
          .select({ value: count() })
          .from(users)
          .then((rows) => Number(rows[0]?.value ?? 0))
      : Promise.resolve(null),
    manager
      ? db
          .select({ value: count() })
          .from(auditLogs)
          .then((rows) => Number(rows[0]?.value ?? 0))
      : Promise.resolve(null),
  ]);

  const roleRows = await listRoles();
  const adminRoleIds = roleRows.filter((item) => item.admin).map((item) => item.id);
  const activeAdmins =
    admin && adminRoleIds.length > 0
      ? await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(
            and(
              inArray(users.role, adminRoleIds),
              eq(users.active, true),
            ),
          )
      : [];

  const aiConfig = admin ? await getAiConfig() : null;

  const cards = [
    {
      href: "/app/profile",
      icon: <GearSix className="size-4" />,
      title: "个人资料",
      description: `修改显示名称与登录密码，当前角色：${roleNameOf(user.role)}`,
      meta: user.name,
      visible: true,
    },
    {
      href: "/admin/settings/ai",
      icon: <Sparkle className="size-4" />,
      title: "AI 分析",
      description: "接入 DeepSeek 等 OpenAI 兼容模型，控制分析页结论的启用与触发方式",
      meta:
        aiConfig && aiConfig.enabled && aiConfig.hasKey
          ? `已启用 · ${aiConfig.model}`
          : "未启用",
      visible: admin,
    },
    {
      href: "/admin/settings/users",
      icon: <Users className="size-4" />,
      title: "用户管理",
      description: "新增用户、调整角色、停用账号、重置密码",
      meta: userStats === null ? "仅管理员" : `${userStats} 个账号`,
      visible: admin,
    },
    {
      href: "/admin/settings/roles",
      icon: <ShieldCheck className="size-4" />,
      title: "角色权限",
      description: "新增角色或调整三档能力（执行级 / 管理级 / 系统管理），权限矩阵自动同步",
      meta: `${roleRows.length} 个角色`,
      visible: true,
    },
    {
      href: "/admin/settings/audit",
      icon: <ClockCounterClockwise className="size-4" />,
      title: "审计日志",
      description: "设备状态、派工、签名、导出、用户与权限变更的不可编辑留痕",
      meta: auditStats === null ? "仅主管与管理员" : `${auditStats} 条记录`,
      visible: manager,
    },
  ].filter((card) => card.visible);

  return (
    <>
      <PageHeader
        eyebrow="System · settings & access"
        title="系统设置"
        description="集中管理个人账号、用户与角色权限，并查看关键操作审计。账号停用或角色调整会在下一次请求立即生效。"
        actions={
          <LinkButton href="/app/profile" variant="secondary">
            <GearSix className="size-4" /> 个人资料
          </LinkButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card group p-5 transition-colors hover:border-ink/25"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-ink text-white">
                {card.icon}
              </span>
              <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-4 text-[14px] font-semibold">{card.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {card.description}
            </p>
            <p className="mt-3 font-mono text-[10px] text-ink-soft">{card.meta}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-[13px] font-semibold">当前账号</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-[16px] font-semibold text-white">
              {user.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{user.name}</p>
              <p className="truncate font-mono text-[10px] text-muted">
                {user.email}
              </p>
            </div>
            <Badge tone={roleToneOf(user.role)} className="ml-auto">
              {roleNameOf(user.role)}
            </Badge>
          </div>
          <p className="mt-3 rounded-xl bg-paper/70 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
            {roleHintOf(user.role)}
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-[13px] font-semibold">系统信息</h2>
          <dl className="mt-3 space-y-2 text-[11px]">
            {[
              ["平台版本", "v1.0 · 轻量版"],
              ["部署形态", "内网 Docker · app + db"],
              ["时区", "Asia/Shanghai（UTC+8）"],
              ["登录有效期", "7 天，账号停用即时失效"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="font-mono text-[10px] text-ink-soft">{value}</dd>
              </div>
            ))}
          </dl>
          {admin && activeAdmins.length > 0 && (
            <p className="mt-3 border-t border-line pt-3 text-[10px] text-muted">
              管理员账号：{activeAdmins.map((item) => item.name).join("、")}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
