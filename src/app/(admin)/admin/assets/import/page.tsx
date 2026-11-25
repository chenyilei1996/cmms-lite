import { ArrowLeft, CloudArrowDown, Table, Warning } from "@phosphor-icons/react/dist/ssr";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils";
import { LinkButton, PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export const metadata = { title: "设备批量导入" };

const COLUMNS = [
  { name: "设备编码", required: "是", hint: "唯一键；已存在则覆盖更新" },
  { name: "设备名称", required: "是", hint: "设备名称" },
  { name: "类别", required: "是", hint: "如 冲压设备 / 动力设备 / 其他" },
  { name: "层级", required: "否", hint: "factory / workshop / line / machine / component，默认单机" },
  { name: "状态", required: "否", hint: "运行中 / 待机 / 故障 / 维修中 / 保养中 / 停用 / 已报废" },
  { name: "关键等级", required: "否", hint: "A / B / C，默认 B" },
  { name: "上级编码", required: "否", hint: "上级设备编码，用于搭建结构树" },
  { name: "位置编码", required: "否", hint: "位置编码或名称，需在位置管理中已存在" },
  { name: "安装位置", required: "否", hint: "自由文本，如 一号车间东侧" },
  { name: "责任人", required: "否", hint: "设备责任人姓名" },
  { name: "制造商", required: "否", hint: "生产厂家" },
  { name: "供应商", required: "否", hint: "采购供应商" },
  { name: "型号", required: "否", hint: "规格型号" },
  { name: "出厂编号", required: "否", hint: "序列号" },
  { name: "购置日期", required: "否", hint: "YYYY-MM-DD" },
  { name: "质保到期", required: "否", hint: "YYYY-MM-DD" },
  { name: "购置成本", required: "否", hint: "数字，可含千分位" },
  { name: "折旧月数", required: "否", hint: "整数月" },
  { name: "技术参数", required: "否", hint: "键=值;键=值" },
  { name: "备注", required: "否", hint: "补充说明" },
];

type ImportDetail = {
  total?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: Array<{ line?: number; code?: string; message?: string }>;
  warnings?: Array<{ line?: number; code?: string; message?: string }>;
  source?: string;
};

export default async function AssetImportPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; enc?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);

  const [last] = await db
    .select({ detail: auditLogs.detail, createdAt: auditLogs.createdAt, actorName: auditLogs.actorName })
    .from(auditLogs)
    .where(eq(auditLogs.action, "asset.import"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  const detail = (last?.detail ?? null) as ImportDetail | null;
  const errors = detail?.errors ?? [];
  const warnings = detail?.warnings ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Admin · assets import"
        title="设备批量导入"
        description="通过 CSV 一次性导入或更新设备主档。按设备编码匹配：已存在则覆盖有值字段，不存在则自动建档并生成二维码。"
        actions={
          <Link
            href="/admin/assets"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> 返回设备台账
          </Link>
        }
      />

      {sp.ok === "done" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          导入完成，结果见下方「最近一次导入」。
          {sp.enc === "gbk" ? "（文件为 GBK 编码，已自动转码）" : ""}
        </p>
      )}
      {sp.error === "forbidden" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          当前角色没有导入设备的权限。
        </p>
      )}
      {sp.error === "empty" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          请选择一个非空的 CSV 文件。
        </p>
      )}
      {sp.error === "too-large" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          文件超过 5MB，请拆分后再导入。
        </p>
      )}
      {sp.error === "norows" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          文件没有解析到数据行，请检查是否包含表头与内容。
        </p>
      )}
      {sp.error === "too-many" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          单次最多导入 20000 行，请拆分文件后重试。
        </p>
      )}
      {sp.error === "parse" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          文件解析失败，请确认是标准 CSV（可另存为 UTF-8 后重试）。
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-5">
          <h2 className="text-[13px] font-semibold">上传 CSV</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            支持逗号分隔与 UTF-8 / GBK 自动识别，首行必须是表头。设备编码、设备名称、类别为必填；上传后会先预览再确认写入。
          </p>

          {manageable ? (
            <ImportForm />
          ) : (
            <p className="mt-4 rounded-xl border border-line bg-paper/60 px-4 py-3 text-[12px] text-muted">
              当前角色仅可查看，导入需要管理员或维修主管权限。
            </p>
          )}

          <div className="mt-4 rounded-xl border border-line bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium">
              <CloudArrowDown className="size-3.5 text-accent" /> 也支持三方系统推送
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              外部系统可通过开放接口直接推送设备主数据，无需手工上传：
              <span className="font-mono"> POST /api/integrations/assets</span>，
              Header 使用集成端点令牌。详见集成中心的接口说明。
            </p>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-[13px] font-semibold">最近一次导入</h2>
          {!last || !detail ? (
            <p className="mt-4 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center text-[12px] text-muted">
              还没有导入记录。
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "新建", value: detail.created ?? 0, tone: "text-mint" },
                  { label: "更新", value: detail.updated ?? 0, tone: "text-accent-ink" },
                  { label: "错误", value: errors.length, tone: errors.length ? "text-danger" : "text-muted" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-line bg-paper/60 px-3 py-2.5">
                    <p className="text-[10px] text-muted">{item.label}</p>
                    <p className={`mt-1 text-[20px] font-semibold tabular-nums ${item.tone}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-muted">
                共 {detail.total ?? 0} 行 · 跳过 {detail.skipped ?? 0} · 警告{" "}
                {warnings.length} · {fmtDateTime(last.createdAt)}
                {last.actorName ? ` · ${last.actorName}` : ""}
              </p>

              {errors.length > 0 && (
                <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-danger/20">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-danger-soft/50 text-[10px] text-danger">
                      <tr>
                        <th className="px-3 py-1.5">行</th>
                        <th className="px-3 py-1.5">编码</th>
                        <th className="px-3 py-1.5">原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {errors.slice(0, 50).map((item, index) => (
                        <tr key={`${item.line}-${index}`}>
                          <td className="px-3 py-1.5 font-mono text-muted">{item.line ?? "-"}</td>
                          <td className="px-3 py-1.5 font-mono">{item.code || "-"}</td>
                          <td className="px-3 py-1.5 text-ink-soft">{item.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {errors.length > 0 && (
                <div className="mt-2">
                  <LinkButton
                    href="/api/import/assets/failures"
                    variant="secondary"
                    size="sm"
                  >
                    下载失败明细 CSV
                  </LinkButton>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="mt-3 rounded-xl border border-honey/20 bg-honey-soft/30 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-medium text-honey">
                    <Warning className="size-3" /> 警告（已忽略对应字段）
                  </p>
                  <ul className="mt-1 space-y-1 text-[10px] text-muted">
                    {warnings.slice(0, 10).map((item, index) => (
                      <li key={`${item.line}-${index}`}>
                        第 {item.line ?? "-"} 行 · {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Table className="size-4 text-muted" />
          <h2 className="text-[13px] font-semibold">字段说明</h2>
          <span className="ml-auto label-mono">CSV HEADER</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead className="bg-paper/60 text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">列名</th>
                <th className="px-4 py-2">必填</th>
                <th className="px-4 py-2">说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COLUMNS.map((column) => (
                <tr key={column.name}>
                  <td className="px-4 py-2 font-medium">{column.name}</td>
                  <td className="px-4 py-2">
                    <span className={column.required === "是" ? "text-accent" : "text-muted"}>
                      {column.required}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted">{column.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
