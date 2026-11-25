"use client";

import {
  ArrowRight,
  CircleNotch,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import type { KbQaPayload } from "@/server/kb-qa";
import { buttonClass } from "./ui";

const SUGGESTIONS = [
  "减速机漏油怎么处理",
  "点检发现轴承温度偏高怎么办",
  "哪些备件有可替代型号",
];

export function KbQaPanel({
  ready,
  model,
  context,
  compact = false,
  initialQuestion = "",
  placeholder = "描述设备、现象或报警代码，例如：注塑机液压油温过高怎么排查",
}: {
  ready: boolean;
  model: string;
  /** 当前工单的设备与故障现象，参与检索和提示词，不作为用户问题展示 */
  context?: string;
  compact?: boolean;
  initialQuestion?: string;
  placeholder?: string;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<KbQaPayload | null>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!ready) {
      setError("AI 问答尚未启用，请联系管理员在系统设置中配置模型与密钥");
      return;
    }
    if (q.length < 2 || loading) return;

    setQuestion(q);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/kb-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });
      const json = (await response.json().catch(() => null)) as {
        payload?: KbQaPayload;
        error?: string;
      } | null;
      if (!response.ok || !json?.payload) {
        setData(null);
        setError(json?.error ?? "问答生成失败，请稍后重试");
        return;
      }
      setData(json.payload);
    } catch {
      setData(null);
      setError("网络异常，未能获取回答");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={compact ? "card overflow-hidden" : "card mt-4 overflow-hidden"}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <Sparkle size={16} weight="fill" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold">
            {compact ? "AI 故障问答" : "AI 知识问答"}
          </h2>
          <p className="mt-0.5 text-[10px] text-muted">
            {ready
              ? compact
                ? `${model} · 已带入本工单设备与故障现象，依据知识库原文作答`
                : `${model} · 先检索已发布知识，再依据原文作答并附来源`
              : "尚未启用，需管理员在系统设置中配置模型与密钥"}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={200}
            placeholder={placeholder}
            className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || question.trim().length < 2}
            className={buttonClass("primary", "sm", "h-10 shrink-0")}
          >
            {loading ? (
              <CircleNotch size={14} className="animate-spin" />
            ) : (
              <Sparkle size={14} weight="fill" />
            )}
            提问
          </button>
        </form>

        {!data && !loading && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => void ask(item)}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] text-ink-soft transition-colors hover:border-ink/25"
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="space-y-2 rounded-xl bg-paper/60 px-4 py-3.5" aria-busy>
            <div className="h-3 w-[88%] animate-pulse rounded-full bg-line/70" />
            <div className="h-3 w-[72%] animate-pulse rounded-full bg-line/70" />
            <p className="pt-1 text-[10px] text-muted">
              正在检索知识库并请求模型，通常需要 5–20 秒…
            </p>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-[12px] leading-relaxed text-danger">
            <WarningCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {data && (
          <div className="space-y-3">
            <p className="rounded-xl bg-paper/60 px-4 py-2.5 text-[11px] text-muted">
              问：{data.question}
            </p>
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink-soft">
              {data.answer}
            </p>

            {data.sources.length > 0 && (
              <div>
                <p className="label-mono mb-1.5">参考来源</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.sources.map((source, index) => (
                    <Link
                      key={source.id}
                      href={`/app/kb/${source.id}`}
                      className="group flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[10.5px] text-accent-ink hover:underline"
                    >
                      <span className="font-mono">{index + 1}</span>
                      {source.title}
                      <span className="text-accent-ink/60">
                        {source.categoryLabel}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {data.followUps.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted">继续问：</span>
                {data.followUps.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void ask(item)}
                    className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] text-ink-soft hover:border-ink/25"
                  >
                    {item}
                    <ArrowRight size={10} />
                  </button>
                ))}
              </div>
            )}

            <p className="border-t border-line/70 pt-2 font-mono text-[10px] text-muted">
              {data.model}
              {data.tokens ? ` · ${data.tokens} tokens` : ""}
              {data.durationMs
                ? ` · 耗时 ${(data.durationMs / 1000).toFixed(1)}s`
                : ""}
              {" · 回答由模型基于知识库生成，请结合现场判断"}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
