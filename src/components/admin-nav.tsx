"use client";

import { ChartBar, ClipboardText, Cube, Gauge, GearSix, Package, Plug, ShoppingCart, SquaresFour, TrendUp } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentType } from "react";
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
  group: string;
};

/** 后台导航：按配置、物料、数据三类归拢，减少一级条目。 */
const items: NavItem[] = [
  { href: "/admin", label: "概览", icon: SquaresFour, group: "设备与配置" },
  { href: "/admin/assets", label: "设备台账", icon: Cube, group: "设备与配置" },
  { href: "/admin/inspection", label: "巡检配置", icon: ClipboardText, group: "设备与配置" },
  { href: "/admin/faults/codes", label: "故障代码", icon: Gauge, group: "设备与配置" },
  { href: "/admin/pdm/sensors", label: "预测配置", icon: TrendUp, group: "设备与配置" },
  { href: "/admin/spare-parts", label: "备件管理", icon: Package, group: "物料与采购" },
  {
    href: "/app/spare-parts/purchase-requests?status=submitted",
    label: "采购审批",
    icon: ShoppingCart,
    group: "物料与采购",
  },
  { href: "/admin/analytics", label: "报表", icon: ChartBar, group: "数据与系统" },
  { href: "/admin/integrations", label: "集成", icon: Plug, group: "数据与系统" },
  { href: "/admin/settings", label: "系统设置", icon: GearSix, group: "数据与系统" },
];

const GROUPS = ["设备与配置", "物料与采购", "数据与系统"];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** 路径可能同时命中外层与内层菜单，只让最精确的一项高亮。 */
function bestMatch(pathname: string) {
  return items
    .map((item) => item.href.split("?")[0])
    .filter((href) => isActive(pathname, href))
    .sort((a, b) => b.length - a.length)[0];
}

export function AdminNav() {
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
                const active = item.href.split("?")[0] === current;
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
                      weight={active ? "fill" : "regular"}
                      className={cn(
                        "size-[17px] shrink-0",
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

export function AdminMobileNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const current = bestMatch(pathname);

  // 后台模块较多，移动端胶囊条较长：进入页面时把当前项滚到中间，
  // 避免用户看到一排标签却不知道自己在哪。
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [pathname]);

  return (
    <nav className="no-print relative overflow-hidden border-b border-line bg-paper/95 backdrop-blur-lg md:hidden">
      <div className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {items.map((item) => {
          const active = item.href.split("?")[0] === current;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={active ? activeRef : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors active:opacity-60",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              <Icon weight={active ? "fill" : "regular"} className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <span className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-paper to-transparent" />
    </nav>
  );
}
