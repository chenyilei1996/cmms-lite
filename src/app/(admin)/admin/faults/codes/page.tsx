import { ArrowLeft, BookOpenText, FloppyDisk, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { downtimeRecords, faultCodes } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { FAULT_CATEGORIES } from "@/lib/constants";
import {
  Badge,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import {
  createFaultCode,
  updateFaultCode,
} from "@/server/reliability-actions";

export const metadata = { title: "故障代码库" };

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

const severityTone = {
  A: "danger",
  B: "honey",
  C: "neutral",
} as const;

export default async function FaultCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);

  const [rows, usageRows] = await Promise.all([
    db
      .select({
        code: faultCodes,
        usage: sql<number>`count(${downtimeRecords.id})`,
      })
      .from(faultCodes)
      .leftJoin(
        downtimeRecords,
        eq(downtimeRecords.faultCodeId, faultCodes.id),
      )
      .groupBy(faultCodes.id)
      .orderBy(asc(faultCodes.code)),
    db.select({ n: count() }).from(downtimeRecords),
  ]);

  const activeCount = rows.filter((row) => row.code.active).length;
  const categoryCount = new Set(rows.map((row) => row.code.category)).size;
  const usageCount = Number(usageRows[0]?.n ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Fault code library"
        title="故障代码库"
        description="统一故障现象、原因与对策，工单选择代码后自动带出标准描述，便于故障统计与知识沉淀。"
        actions={
          <LinkButton href="/app/faults" variant="secondary">
            <ArrowLeft className="size-4" /> 返回分析
          </LinkButton>
        }
      />

      {sp.ok && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          故障代码已保存。
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="代码总数"
          value={rows.length}
          tone="neutral"
          icon={<BookOpenText className="size-4" />}
        />
        <StatCard
          label="启用中"
          value={activeCount}
          tone="mint"
          icon={<BookOpenText className="size-4" />}
        />
        <StatCard
          label="故障类别"
          value={categoryCount}
          tone="honey"
          icon={<BookOpenText className="size-4" />}
        />
        <StatCard
          label="关联停机"
          value={usageCount}
          tone="accent"
          icon={<BookOpenText className="size-4" />}
          sub="引用次数"
        />
      </div>

      {manageable && (
        <section className="card mb-4 p-5">
          <details>
            <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
              <Plus className="size-4 text-muted" /> 新增故障代码
            </summary>
            <form
              action={createFaultCode}
              className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
            >
              <label className="text-[10px] text-muted">
                代码
                <input
                  name="code"
                  required
                  placeholder="F011"
                  className={`${inputClass} mt-1 font-mono uppercase`}
                />
              </label>
              <label className="text-[10px] text-muted">
                名称
                <input
                  name="name"
                  required
                  placeholder="例如：液压系统泄漏"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted">
                类别
                <select name="category" className={`${inputClass} mt-1`}>
                  {FAULT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted">
                严重度
                <select name="severity" className={`${inputClass} mt-1`}>
                  <option value="A">A · 高</option>
                  <option value="B">B · 中</option>
                  <option value="C">C · 低</option>
                </select>
              </label>
              <label className="text-[10px] text-muted sm:col-span-2">
                典型现象
                <input
                  name="phenomenon"
                  placeholder="例如：油管接头渗油、压力下降"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted sm:col-span-2">
                常见原因
                <input
                  name="cause"
                  placeholder="例如：密封圈老化、接头松动"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] text-muted sm:col-span-2 lg:col-span-3">
                标准对策
                <input
                  name="countermeasure"
                  placeholder="例如：更换密封圈并紧固接头，试压 30 分钟"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <div className="flex items-end">
                <SubmitButton size="sm" className="h-9 w-full">
                  保存代码
                </SubmitButton>
              </div>
            </form>
          </details>
        </section>
      )}

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">
          还没有故障代码，先新增第一条标准代码。
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ code, usage }) => (
            <section key={code.id} className="card overflow-hidden">
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold">
                      {code.code}
                    </span>
                    <span className="text-[13px] font-medium">{code.name}</span>
                    <Badge tone={severityTone[code.severity]}>
                      {code.severity} 级
                    </Badge>
                    <Badge tone="neutral">{code.category}</Badge>
                    {!code.active && <Badge tone="neutral">已停用</Badge>}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    现象：{code.phenomenon ?? "—"} · 原因：
                    {code.cause ?? "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    对策：{code.countermeasure ?? "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted">
                  <span>
                    引用 <span className="font-mono text-ink">{Number(usage)}</span> 次
                  </span>
                  <Link
                    href="/app/faults"
                    className="text-[10px] hover:text-ink"
                  >
                    查看分析
                  </Link>
                </div>
              </div>

              {manageable && (
                <details className="border-t border-line bg-paper/30 px-5 py-3">
                  <summary className="cursor-pointer text-[11px] text-muted">
                    编辑代码
                  </summary>
                  <form
                    action={updateFaultCode}
                    className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <input type="hidden" name="id" value={code.id} />
                    <label className="text-[10px] text-muted">
                      名称
                      <input
                        name="name"
                        defaultValue={code.name}
                        required
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                    <label className="text-[10px] text-muted">
                      类别
                      <select
                        name="category"
                        defaultValue={code.category}
                        className={`${inputClass} mt-1`}
                      >
                        {FAULT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] text-muted">
                      严重度
                      <select
                        name="severity"
                        defaultValue={code.severity}
                        className={`${inputClass} mt-1`}
                      >
                        <option value="A">A · 高</option>
                        <option value="B">B · 中</option>
                        <option value="C">C · 低</option>
                      </select>
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-[11px] text-muted">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={code.active}
                        className="size-3.5 accent-ink"
                      />
                      启用
                    </label>
                    <label className="text-[10px] text-muted sm:col-span-2">
                      典型现象
                      <input
                        name="phenomenon"
                        defaultValue={code.phenomenon ?? ""}
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                    <label className="text-[10px] text-muted sm:col-span-2">
                      常见原因
                      <input
                        name="cause"
                        defaultValue={code.cause ?? ""}
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                    <label className="text-[10px] text-muted sm:col-span-2 lg:col-span-3">
                      标准对策
                      <input
                        name="countermeasure"
                        defaultValue={code.countermeasure ?? ""}
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                    <div className="flex items-end">
                      <SubmitButton size="sm" className="h-9 w-full">
                        <FloppyDisk className="size-3.5" /> 保存修改
                      </SubmitButton>
                    </div>
                  </form>
                </details>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
