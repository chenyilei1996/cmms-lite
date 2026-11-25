"use client";

import { List, SidebarSimple } from "@phosphor-icons/react";

const STORAGE_KEY = "cmms:sidebar";

function toggleSidebar() {
  const root = document.documentElement;
  const collapsed = root.dataset.sidebar !== "collapsed";
  root.dataset.sidebar = collapsed ? "collapsed" : "expanded";
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // 隐私模式下 localStorage 不可用，忽略即可，仅本次生效
  }
}

export function SidebarToggle({
  variant = "collapse",
}: {
  variant?: "collapse" | "expand";
}) {
  if (variant === "expand") {
    return (
      <button
        type="button"
        onClick={toggleSidebar}
        className="sidebar-expand mb-4 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted shadow-sm transition-colors hover:text-ink"
      >
        <List size={16} />
        显示菜单
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="隐藏侧边栏"
      title="隐藏侧边栏"
      className="sidebar-collapse flex size-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
    >
      <SidebarSimple size={16} />
    </button>
  );
}
