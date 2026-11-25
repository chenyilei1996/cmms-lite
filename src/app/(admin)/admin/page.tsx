import { ArrowUpRight, ChartBar, ClipboardText, Cube, Gauge, GearSix, Package, Plug, ShieldCheck, ShoppingCart, TrendUp, Users } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  purchaseRequests,
  spareParts,
  users,
} from "@/db/schema";
import { PageHeader, StatCard } from "@/components/ui";

export const metadata = { title: "管理后台" };

export default async function AdminHomePage() {
  const [assetTotal, pendingPr, lowStock, activeUsers] = await Promise.all([
    db
      .select({ value: count() })
      .from(assets)
      .then((rows) => Number(rows[0]?.value ?? 0)),
    db
      .select({ value: count() })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.status, "submitted"))
      .then((rows) => Number(rows[0]?.value ?? 0)),
    db
      .select({ value: count() })
      .from(spareParts)
      .where(sql`${spareParts.stockQty} < ${spareParts.safetyStock}`)
      .then((rows) => Number(rows[0]?.value ?? 0)),
    db
      .select({ value: count() })
      .from(users)
      .where(eq(users.active, true))
      .then((rows) => Number(rows[0]?.value ?? 0)),
  ]);

  const modules = [
    {
      href: "/admin/assets",
      icon: <Cube className="size-4" />,
      title: "设备台账",
      description: "新增设备、维护五级结构树、打印二维码标签。",
      meta: `${assetTotal} 台设备`,
    },
    {
      href: "/admin/inspection",
      icon: <ClipboardText className="size-4" />,
      title: "巡检配置",
      description: "维护点检 / 保养模板与周期计划，启用停用与运行计数。",
      meta: "模板 · 计划",
    },
    {
      href: "/admin/spare-parts",
      icon: <Package className="size-4" />,
      title: "备件管理",
      description: "备件建档、二维码标签与按仓库盘点。",
      meta: lowStock > 0 ? `${lowStock} 项低库存` : "库存正常",
    },
    {
      href: "/app/spare-parts/purchase-requests?status=submitted",
      icon: <ShoppingCart className="size-4" />,
      title: "采购审批",
      description: "审批技术员提交的采购申请，驳回需填写原因。",
      meta: pendingPr > 0 ? `${pendingPr} 单待审批` : "暂无待审批",
    },
    {
      href: "/admin/faults/codes",
      icon: <Gauge className="size-4" />,
      title: "故障代码",
      description: "维护标准故障现象、原因与对策，供工单引用。",
      meta: "代码库",
    },
    {
      href: "/admin/pdm/sensors",
      icon: <TrendUp className="size-4" />,
      title: "预测配置",
      description: "配置测点、阈值 / 持续 / 斜率规则与读数采集。",
      meta: "测点与规则",
    },
    {
      href: "/admin/analytics",
      icon: <ChartBar className="size-4" />,
      title: "报表与 KPI",
      description: "工单、保养、点检、备件、成本与故障分析。",
      meta: "六类报表",
    },
    {
      href: "/admin/integrations",
      icon: <Plug className="size-4" />,
      title: "集成中心",
      description: "MES / ERP 端点、同步任务、运行记录与对账。",
      meta: "同步与对账",
    },
    {
      href: "/admin/settings",
      icon: <GearSix className="size-4" />,
      title: "系统设置",
      description: "用户、角色权限与审计日志。",
      meta: `${activeUsers} 个启用账号`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Admin console · configuration"
        title="管理后台"
        description="配置类与审批类操作集中在这里，前台只保留现场日常使用的工作台。"
        actions={
          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] text-muted transition-colors hover:text-ink"
          >
            <ArrowUpRight className="size-3.5" /> 前往前台
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="设备总数"
          value={assetTotal}
          tone="mint"
          icon={<Cube className="size-4" />}
          sub="台账在册"
        />
        <StatCard
          label="待审批采购"
          value={pendingPr}
          tone="honey"
          icon={<ShoppingCart className="size-4" />}
          sub="需要主管处理"
        />
        <StatCard
          label="低库存备件"
          value={lowStock}
          tone={lowStock > 0 ? "danger" : "mint"}
          icon={<Package className="size-4" />}
          sub="低于安全库存"
        />
        <StatCard
          label="启用账号"
          value={activeUsers}
          tone="accent"
          icon={<Users className="size-4" />}
          sub="含管理员与现场"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card group p-5 transition-colors hover:border-ink/25"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-ink text-white">
                {item.icon}
              </span>
              <ArrowUpRight className="size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <p className="mt-4 text-[14px] font-semibold">{item.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {item.description}
            </p>
            <p className="mt-3 font-mono text-[10px] text-ink-soft">{item.meta}</p>
          </Link>
        ))}
      </div>

      <p className="mt-6 flex items-center gap-2 rounded-xl border border-line bg-paper/60 px-4 py-3 text-[11px] text-muted">
        <ShieldCheck className="size-3.5 text-accent" />
        后台仅对管理员与维修主管开放；技术员与只读账号会被自动送回前台工作台。
      </p>
    </>
  );
}
