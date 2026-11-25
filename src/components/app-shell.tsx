import Link from "next/link";
import {
  BookOpenText,
  ShieldCheck,
  SignOut,
  User,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { logoutAction } from "@/server/auth-actions";
import { canManage } from "@/lib/auth";
import type { Role } from "@/lib/constants";
import { roleNameOf } from "@/lib/roles";
import { Avatar } from "./ui";
import { ConfirmSubmitButton } from "./ui-client";
import { DesktopNav, MobileNav } from "./nav-links";
import { Logo } from "./logo";
import { SidebarToggle } from "./sidebar-toggle";

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: Role };
  children: ReactNode;
}) {
  const manageable = canManage(user.role);

  return (
    <div className="app-shell min-h-screen md:grid md:grid-cols-[220px_1fr] lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col overflow-y-auto overflow-x-hidden border-r border-white/5 bg-sidebar px-3 py-6 text-white md:flex lg:px-4">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex items-center justify-between gap-2 px-2">
          <Logo dark />
          <SidebarToggle />
        </div>
        <div className="relative flex-1">
          <DesktopNav />
        </div>
        <div className="relative mt-6 border-t border-white/10 pt-4">
          {manageable && (
            <Link
              href="/admin"
              className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <ShieldCheck size={16} weight="regular" className="text-accent-on-dark" />
              管理后台
            </Link>
          )}
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-2 py-2">
            <Avatar name={user.name} className="bg-accent-on-dark text-ink" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-white">
                {user.name}
              </p>
              <p className="truncate text-[10px] text-white/40">
                {roleNameOf(user.role)}
              </p>
            </div>
            <Link
              href="/app/profile"
              aria-label="个人资料"
              className="flex size-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <User size={16} weight="regular" />
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="退出登录"
                className="flex size-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SignOut size={16} weight="regular" />
              </button>
            </form>
          </div>
          <p className="mt-3 flex items-center gap-1.5 px-2 font-mono text-[9px] tracking-wider text-white/25">
            <ShieldCheck size={12} weight="regular" />
            内网 · v1.0
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-black/[0.06] bg-white/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-2xl md:hidden">
          <Logo />
          <div className="flex items-center gap-0.5">
            <Link
              href="/app/kb"
              aria-label="设备知识库"
              className="flex size-10 items-center justify-center rounded-full text-muted transition-colors active:bg-black/5"
            >
              <BookOpenText size={21} weight="regular" />
            </Link>
            {manageable && (
              <Link
                href="/admin"
                aria-label="管理后台"
                className="flex size-10 items-center justify-center rounded-full text-muted transition-colors active:bg-black/5"
              >
                <ShieldCheck size={21} weight="regular" />
              </Link>
            )}
            <span className="hidden rounded-full bg-paper px-2.5 py-1 text-[10px] text-muted sm:inline">
              {roleNameOf(user.role)}
            </span>
            <Link
              href="/app/profile"
              aria-label="个人资料"
              className="flex size-10 items-center justify-center"
            >
              <Avatar name={user.name} size="sm" className="bg-accent" />
            </Link>
            <form action={logoutAction}>
              <ConfirmSubmitButton
                message="确认退出登录？退出后需要重新输入账号密码。"
                iconOnly
                ariaLabel="退出登录"
                className="flex size-10 items-center justify-center rounded-full text-muted transition-colors active:bg-black/5"
              >
                <SignOut size={21} weight="regular" />
              </ConfirmSubmitButton>
            </form>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 md:px-7 md:pb-10 md:pt-6 lg:px-10 lg:pb-14 lg:pt-10">
          <div className="mx-auto w-full max-w-[1180px]">
            <SidebarToggle variant="expand" />
            {children}
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
