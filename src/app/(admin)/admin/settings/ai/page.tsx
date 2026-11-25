import {
  ArrowRight,
  ClockCounterClockwise,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdmin, requireUser } from "@/lib/auth";
import { AI_DEFAULT_BASE_URL, AI_DEFAULT_MODEL } from "@/lib/ai";
import { getAiConfig } from "@/lib/ai-config";
import { fmtDateTime } from "@/lib/utils";
import {
  Badge,
  Field,
  Input,
  LinkButton,
  PageHeader,
  SectionTitle,
  Select,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { AiTestButton } from "@/components/ai-test-button";
import { getAiHistory } from "@/server/ai-analysis";
import { saveAiConfig } from "@/server/ai-actions";

export const metadata = { title: "AI 分析配置" };

const TRIGGER_LABEL = {
  manual: "手动点击生成",
  auto: "打开页面自动生成",
} as const;

export default async function AiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/admin/settings");

  const [config, history] = await Promise.all([
    getAiConfig(),
    getAiHistory(10),
  ]);
  const ready = config.enabled && config.hasKey;

  return (
    <>
      <PageHeader
        eyebrow="System · ai analysis"
        title="AI 分析配置"
        description="接入 DeepSeek 或任意 OpenAI 兼容模型，为「故障与停机分析」页生成结论、风险点与改进建议。密钥加密存储，仅在服务端调用。"
        actions={
          <>
            <LinkButton href="/admin/settings" variant="secondary">
              系统设置
            </LinkButton>
            <LinkButton href="/app/faults">
              <Sparkle className="size-4" /> 查看分析页
            </LinkButton>
          </>
        }
      />

      {sp.ok === "1" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          AI 配置已保存，分析页将按新设置展示。
        </p>
      )}
      {sp.error === "url" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          接口地址不是合法的 http/https 地址，请检查后重试。
        </p>
      )}
      {sp.error === "model" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          请填写模型名称，例如 deepseek-chat。
        </p>
      )}
      {sp.error === "key" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          启用 AI 分析前必须先保存 API Key。
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-5">
          <SectionTitle
            title="模型接入"
            extra={<span className="label-mono">OPENAI COMPATIBLE</span>}
          />
          <form action={saveAiConfig} className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-line bg-paper/60 px-4 py-3">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={config.enabled}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              <span>
                <span className="text-[12px] font-medium">启用 AI 分析</span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                  关闭后分析页不展示 AI 结论，也不会调用模型；历史记录保留。
                </span>
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="接口地址" hint="OpenAI 兼容">
                <Input
                  name="baseUrl"
                  defaultValue={config.baseUrl}
                  placeholder={AI_DEFAULT_BASE_URL}
                  spellCheck={false}
                />
              </Field>
              <Field label="模型名称" hint="默认 deepseek-chat">
                <Input
                  name="model"
                  defaultValue={config.model}
                  placeholder={AI_DEFAULT_MODEL}
                  spellCheck={false}
                />
              </Field>
            </div>

            <Field
              label="API Key"
              hint={config.hasKey ? "已保存，留空保持不变" : "启用时必填"}
            >
              <Input
                name="apiKey"
                type="password"
                autoComplete="off"
                placeholder={
                  config.hasKey ? "••••••••（留空保持不变）" : "sk-..."
                }
              />
            </Field>

            {config.hasKey && (
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <input
                  type="checkbox"
                  name="clearKey"
                  className="size-3.5 accent-[var(--danger)]"
                />
                清除已保存的密钥（清除后需重新填写才能启用）
              </label>
            )}

            <Field label="触发方式" hint="控制分析页行为">
              <Select name="triggerMode" defaultValue={config.triggerMode}>
                <option value="manual">手动点击生成</option>
                <option value="auto">
                  打开页面自动生成（24 小时内同数据复用结论）
                </option>
              </Select>
            </Field>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <SubmitButton size="sm" className="h-9">
                保存配置
              </SubmitButton>
              <AiTestButton />
            </div>
            <p className="text-[10px] leading-relaxed text-muted">
              提示：测试连通性只请求模型列表，不产生推理费用，请先保存再测试。
            </p>
          </form>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <SectionTitle
              title="当前状态"
              extra={
                <Badge tone={ready ? "mint" : "neutral"}>
                  {ready ? "已启用" : "未启用"}
                </Badge>
              }
            />
            <dl className="space-y-2 text-[11px]">
              {[
                ["接口地址", config.baseUrl],
                ["模型", config.model],
                ["密钥", config.hasKey ? "已配置" : "未配置"],
                ["触发方式", TRIGGER_LABEL[config.triggerMode]],
                [
                  "最近更新",
                  config.updatedAt ? fmtDateTime(config.updatedAt) : "尚未配置",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="shrink-0 text-muted">{label}</dt>
                  <dd className="truncate text-right font-mono text-[10px] text-ink-soft">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 rounded-xl bg-paper/70 px-3 py-2.5 text-[10px] leading-relaxed text-muted">
              密钥使用 SESSION_SECRET 派生的 AES-256-GCM 密钥加密后落库，页面不会回显明文；
              更换 SESSION_SECRET 后需要重新录入。
            </p>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
                <ClockCounterClockwise className="size-4 text-muted" />
                最近分析历史
              </h2>
              <Link
                href="/app/faults"
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
              >
                分析页 <ArrowRight className="size-3" />
              </Link>
            </div>
            {history.length === 0 ? (
              <p className="px-5 py-6 text-[12px] text-muted">
                还没有生成过 AI 分析。启用后到分析页点击「生成分析」即可。
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((item) => (
                  <li key={item.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">近 {item.days} 天</Badge>
                      <span className="font-mono text-[10px] text-muted">
                        {fmtDateTime(item.createdAt)}
                      </span>
                      {item.createdByName && (
                        <span className="text-[10px] text-muted">
                          {item.createdByName}
                        </span>
                      )}
                      <Link
                        href={`/app/faults?days=${item.days}`}
                        className="ml-auto text-[10px] text-muted hover:text-ink"
                      >
                        查看
                      </Link>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-soft">
                      {item.summary}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
