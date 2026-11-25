import { ArrowLeft, SignOut, User } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/server/auth-actions";
import type { Role } from "@/lib/constants";
import { roleNameOf } from "@/lib/roles";
import { Avatar } from "./ui";
import { ConfirmSubmitButton } from "./ui-client";
import { AdminMobileNav, AdminNav } from "./admin-nav";
import { Logo } from "./logo";
import { SidebarToggle } from "./sidebar-toggle";

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: Role };
  children: ReactNode;
}) {
  return (
    <div className="app-shell min-h-screen md:grid md:grid-cols-[220px_1fr] lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col overflow-y-auto overflow-x-hidden border-r border-white/5 bg-sidebar px-3 py-6 text-white md:flex lg:px-4">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex items-start justify-between gap-2 px-2">
          <div className="min-w-0">
            <Logo dark href="/admin" />
            <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-accent-on-dark">
              ADMIN CONSOLE
            </span>
          </div>
          <SidebarToggle />
        </div>
        <div className="relative flex-1">
          <AdminNav />
        </div>
        <div className="relative mt-6 border-t border-white/10 pt-4">
          <Link
            href="/app/dashboard"
            className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="size-4 text-accent-on-dark" />
            返回前台工作台
          </Link>
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
              <User className="size-4" />
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="退出登录"
                className="flex size-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SignOut className="size-4" />
              </button>
            </form>
          </div>
          <p className="mt-3 px-2 font-mono text-[9px] tracking-wider text-white/25">
            配置 · 审批 · 分析
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-line bg-paper/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg md:hidden">
          <div className="flex items-center gap-2">
            <Logo href="/admin" />
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[9px] tracking-wider text-accent-ink">
              后台
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/dashboard"
              aria-label="返回前台"
              className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <Link href="/app/profile" aria-label="个人资料">
              <Avatar name={user.name} size="sm" className="bg-accent" />
            </Link>
            <form action={logoutAction}>
              <ConfirmSubmitButton
                message="确认退出登录？退出后需要重新输入账号密码。"
                iconOnly
                ariaLabel="退出登录"
                className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <SignOut className="size-4" />
              </ConfirmSubmitButton>
            </form>
          </div>
        </header>

        <div className="md:hidden">
          <AdminMobileNav />
        </div>

        <main className="flex-1 px-4 pb-14 pt-5 sm:px-6 md:px-7 md:pt-6 lg:px-10 lg:pb-14 lg:pt-10">
          <div className="mx-auto w-full max-w-[1180px]">
            <SidebarToggle variant="expand" />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
