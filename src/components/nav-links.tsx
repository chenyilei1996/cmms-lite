"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Bell,
  BookOpenText,
  CalendarCheck,
  ChartLineUp,
  ClipboardText,
  Cube,
  DotsThreeCircle,
  Path,
  Package,
  Pulse,
  SquaresFour,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<{
  size?: number | string;
  weight?: "regular" | "fill";
  className?: string;
}>;

type NavItem = {
  href: string;
  label: string;
  icon: IconComponent;
  group?: string;
  desktopOnly?: boolean;
};

/** 前台工作区导航：按使用场景分组，配置类入口统一收在后台。 */
const items: NavItem[] = [
  { href: "/app/dashboard", label: "总览", icon: SquaresFour, group: "工作台" },
  { href: "/app/notifications", label: "通知", icon: Bell, group: "工作台" },
  { href: "/app/assets", label: "设备", icon: Cube, group: "设备与物料" },
  { href: "/app/spare-parts", label: "备件", icon: Package, group: "设备与物料" },
  { href: "/app/work-orders", label: "工单", icon: ClipboardText, group: "现场作业" },
  { href: "/app/inspection", label: "保养", icon: CalendarCheck, group: "现场作业" },
  { href: "/app/inspection/routes", label: "点检", icon: Path, group: "现场作业" },
  { href: "/app/kb", label: "知识", icon: BookOpenText, group: "知识与洞察", desktopOnly: true },
  { href: "/app/faults", label: "分析", icon: Pulse, group: "知识与洞察" },
  { href: "/app/pdm", label: "预测", icon: ChartLineUp, group: "知识与洞察" },
];

const GROUPS = ["工作台", "设备与物料", "现场作业", "知识与洞察"];

/** 手机底部只保留 4 个高频入口 + 更多，图标才能做到主流 App 的尺寸。 */
const mobileItems: NavItem[] = [
  { href: "/app/dashboard", label: "总览", icon: SquaresFour },
  { href: "/app/assets", label: "设备", icon: Cube },
  { href: "/app/work-orders", label: "工单", icon: ClipboardText },
  { href: "/app/inspection", label: "保养", icon: CalendarCheck },
  { href: "/app/more", label: "更多", icon: DotsThreeCircle },
];

/** 收进「更多」的页面，进入这些页面时底部高亮「更多」。 */
const morePaths = [
  "/app/inspection/routes",
  "/app/spare-parts",
  "/app/kb",
  "/app/faults",
  "/app/pdm",
  "/app/notifications",
  "/app/profile",
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 路径可能同时命中外层与内层菜单，只让最精确的一项高亮。 */
function bestMatch(pathname: string) {
  return items
    .map((item) => item.href)
    .filter((href) => isActive(pathname, href))
    .sort((a, b) => b.length - a.length)[0];
}

function isMoreActive(pathname: string) {
  return (
    pathname === "/app/more" ||
    morePaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

function isMobileActive(pathname: string, href: string) {
  if (href === "/app/more") return isMoreActive(pathname);
  if (href === "/app/inspection") {
    // 点检路线归在「更多」里，避免和「保养」同时高亮
    return isActive(pathname, href) && !pathname.startsWith("/app/inspection/routes");
  }
  return isActive(pathname, href);
}

export function DesktopNav() {
  const pathname = usePathname();
  const current = bestMatch(pathname);
  return (
    <nav className="mt-6">
      {GROUPS.map((group, index) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className={index === 0 ? "" : "pt-3.5"}>
            <p className="mb-1 flex items-center gap-2 px-3 text-[10px] font-medium tracking-[0.12em] text-white/28">
              <span className="h-px w-2.5 bg-white/20" />
              {group}
            </p>
            <div className="space-y-0.5">
              {groupItems.map((item) => {
                const active = item.href === current;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors",
                      active
                        ? "bg-white/[0.12] font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-white/55 hover:text-white",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent-on-dark" />
                    )}
                    <Icon
                      size={17}
                      weight={active ? "fill" : "regular"}
                      className={cn(
                        "shrink-0",
                        active
                          ? "text-accent-on-dark"
                          : "text-white/40 group-hover:text-white/80",
                      )}
                    />
                    {item.label}
                    {active && (
                      <span className="ml-auto size-1.5 rounded-full bg-accent-on-dark" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-[#f7f6f2]/85 backdrop-blur-2xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 pb-[max(4px,env(safe-area-inset-bottom))] pt-1.5">
        {mobileItems.map((item) => {
          const active = isMobileActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-0.5 py-1 active:opacity-60"
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-accent-soft",
                )}
              >
                <Icon
                  size={24}
                  weight={active ? "fill" : "regular"}
                  className={cn(
                    "transition-colors",
                    active ? "text-accent" : "text-muted",
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  active ? "text-accent" : "text-muted",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
