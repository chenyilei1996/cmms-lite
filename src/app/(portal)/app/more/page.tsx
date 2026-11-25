import Link from "next/link";
import type { ComponentType } from "react";
import {
  Bell,
  BookOpenText,
  ChartLineUp,
  Package,
  Path,
  Pulse,
  ShieldCheck,
  SignOut,
  User,
} from "@phosphor-icons/react/dist/ssr";
import { canManage, requireUser } from "@/lib/auth";
import { roleNameOf } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/auth-actions";
import { Avatar, ChevronRight } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ui-client";

export const metadata = { title: "更多" };

type IconComponent = ComponentType<{
  size?: number | string;
  weight?: "regular" | "fill";
  className?: string;
}>;

type Row = {
  href: string;
  label: string;
  icon: IconComponent;
  color: string;
};

const rows: Row[] = [
  { href: "/app/inspection/routes", label: "点检路线", icon: Path, color: "bg-mint" },
  { href: "/app/spare-parts", label: "备件库存", icon: Package, color: "bg-honey" },
  { href: "/app/kb", label: "知识库", icon: BookOpenText, color: "bg-[#3a6b93]" },
  { href: "/app/faults", label: "故障分析", icon: Pulse, color: "bg-danger" },
  { href: "/app/pdm", label: "预测维护", icon: ChartLineUp, color: "bg-[#6b5a8c]" },
  { href: "/app/notifications", label: "通知", icon: Bell, color: "bg-accent" },
  { href: "/app/profile", label: "个人资料", icon: User, color: "bg-[#7e7a72]" },
];

export default async function MorePage() {
  const user = await requireUser();
  const manageable = canManage(user.role);

  return (
    <>
      <div className="mb-4 px-1">
        <h1 className="text-[30px] font-bold tracking-[-0.03em]">更多</h1>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <Avatar name={user.name} size="lg" className="bg-accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold">{user.name}</p>
            <p className="truncate text-[13px] text-muted">{user.email}</p>
          </div>
          <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] text-muted">
            {roleNameOf(user.role)}
          </span>
        </div>
      </section>

      <p className="mb-1.5 mt-6 px-4 text-[12px] text-muted">功能</p>
      <section className="card overflow-hidden divide-y divide-line">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <Link
              key={row.href}
              href={row.href}
              className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-paper"
            >
              <span
                className={cn(
                  "flex size-[29px] shrink-0 items-center justify-center rounded-[7px] text-white",
                  row.color,
                )}
              >
                <Icon size={17} weight="fill" />
              </span>
              <span className="flex-1 text-[16px]">{row.label}</span>
              <ChevronRight className="size-4 text-muted/60" />
            </Link>
          );
        })}
      </section>

      {manageable && (
        <>
          <p className="mb-1.5 mt-6 px-4 text-[12px] text-muted">管理</p>
          <section className="card overflow-hidden">
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-paper"
            >
              <span className="flex size-[29px] shrink-0 items-center justify-center rounded-[7px] bg-ink text-white">
                <ShieldCheck size={17} weight="fill" />
              </span>
              <span className="flex-1 text-[16px]">管理后台</span>
              <ChevronRight className="size-4 text-muted/60" />
            </Link>
          </section>
        </>
      )}

      <p className="mb-1.5 mt-6 px-4 text-[12px] text-muted">账号</p>
      <section className="card overflow-hidden">
        <form action={logoutAction}>
          <ConfirmSubmitButton
            message="确认退出登录？退出后需要重新输入账号密码。"
            className="flex w-full items-center justify-center gap-2 py-3.5 text-[16px] text-danger transition-colors active:bg-paper disabled:opacity-60"
          >
            <SignOut size={18} weight="regular" />
            退出登录
          </ConfirmSubmitButton>
        </form>
      </section>

      <p className="mt-6 text-center text-[11px] text-muted">
        月立集团 · 设备管理 YUELI CMMS
      </p>
    </>
  );
}
