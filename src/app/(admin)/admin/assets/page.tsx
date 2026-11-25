import { ArrowLeft, ArrowUpRight, Cube, Graph, MapPin, Package, PencilSimple, QrCode, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "设备台账配置" };

const entries = [
  {
    href: "/admin/assets/new",
    icon: <Package className="size-4" />,
    title: "新增设备",
    description: "录入设备主档，可指定上级节点与层级，支持挂接部件。",
    meta: "主档录入",
  },
  {
    href: "/app/assets",
    icon: <PencilSimple className="size-4" />,
    title: "设备主档编辑",
    description: "按编码或名称找到设备，在详情页修改主档、状态与文档。",
    meta: "选择设备后编辑",
  },
  {
    href: "/admin/assets/tree",
    icon: <Graph className="size-4" />,
    title: "设备结构树",
    description: "工厂 → 车间 → 产线 → 单机 → 部件五级结构，支持节点移动。",
    meta: "层级维护",
  },
  {
    href: "/admin/assets/locations",
    icon: <MapPin className="size-4" />,
    title: "位置管理",
    description: "维护车间、产线、区域等安装位置，建档时可直接选择。",
    meta: "基础数据",
  },
  {
    href: "/admin/assets/qr",
    icon: <QrCode className="size-4" />,
    title: "二维码标签",
    description: "按设备勾选并批量打印标签，扫码直达设备自助页。",
    meta: "标签打印",
  },
  {
    href: "/admin/assets/import",
    icon: <UploadSimple className="size-4" />,
    title: "批量导入 / 三方同步",
    description: "CSV 批量导入设备主档，或由三方系统通过开放接口推送同步。",
    meta: "导入 · 同步",
  },
];

export default function AdminAssetsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin · assets master data"
        title="设备台账"
        description="设备主档与结构维护属于后台配置；日常查看、报修与工单执行在前台。"
        actions={
          <Link
            href="/app/assets"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> 前台设备台账
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((item) => (
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

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-paper/60 px-4 py-3 text-[11px] text-muted">
        <Cube className="size-3.5 text-accent" />
        设备状态变更、工单与点检记录仍在设备详情页查看。
      </div>
    </>
  );
}
