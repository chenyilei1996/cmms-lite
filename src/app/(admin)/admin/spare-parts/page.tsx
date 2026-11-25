import { ArrowLeft, ArrowUpRight, ClipboardText, Package, PencilSimple, QrCode, ShoppingCart, Warehouse } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "备件管理" };

const entries = [
  {
    href: "/admin/spare-parts/new",
    icon: <Package className="size-4" />,
    title: "新增备件",
    description: "维护编码、类别、规格、安全库存与参考单价。",
    meta: "备件建档",
  },
  {
    href: "/app/spare-parts",
    icon: <PencilSimple className="size-4" />,
    title: "档案编辑与仓库",
    description: "修改已有备件参数与安全库存，新增仓库和库位。",
    meta: "选择备件后编辑",
  },
  {
    href: "/admin/spare-parts/qr",
    icon: <QrCode className="size-4" />,
    title: "备件二维码",
    description: "批量打印标签，扫码进入移动端领用。",
    meta: "标签打印",
  },
  {
    href: "/admin/spare-parts/stocktake",
    icon: <Warehouse className="size-4" />,
    title: "库存盘点",
    description: "按仓库生成盘点单，录入实盘后自动调整库存。",
    meta: "对账调整",
  },
  {
    href: "/app/spare-parts/purchase-requests?status=submitted",
    icon: <ShoppingCart className="size-4" />,
    title: "采购审批",
    description: "审批待办、驳回原因与到货入库。",
    meta: "审批入口",
  },
];

export default function AdminSparePartsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin · spare parts master data"
        title="备件管理"
        description="建档、标签与盘点属于后台配置；领用、退料与采购申请提交在前台完成。"
        actions={
          <Link
            href="/app/spare-parts"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> 前台备件台账
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
        <ClipboardText className="size-3.5 text-accent" />
        库存流水与批次明细在备件详情页查看。
      </div>
    </>
  );
}
