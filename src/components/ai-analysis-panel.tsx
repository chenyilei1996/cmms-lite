"use client";

import {
  ArrowClockwise,
  CircleNotch,
  ClockCounterClockwise,
  Sparkle,
  Target,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AiAnalysisPayload,
  AiHistoryItem,
  AiTriggerMode,
} from "@/lib/ai";
import { fmtDateTime } from "@/lib/utils";
import { Badge, buttonClass } from "./ui";

const LEVEL_META = {
  high: { label: "高风险", tone: "danger" as const },
  medium: { label: "需关注", tone: "honey" as const },
  low: { label: "提示", tone: "neutral" as const },
};

export function AiAnalysisPanel({
  days,
  ready,
  model,
  triggerMode,
  canConfigure,
  initial,
  history,
}: {
  days: number;
  ready: boolean;
  model: string;
  triggerMode: AiTriggerMode;
  canConfigure: boolean;
  initial: AiAnalysisPayload | null;
  history: AiHistoryItem[];
}) {
  const [data, setData] = useState<AiAnalysisPayload | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const run = useCallback(
    async (refresh: boolean) => {
      if (!ready) {
        setError("管理员尚未启用 AI 分析，请联系系统管理员");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/ai/faults-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days, refresh }),
        });
        const json = (await response.json().catch(() => null)) as {
          payload?: AiAnalysisPayload;
          error?: string;
        } | null;
        if (!response.ok || !json?.payload) {
          setError(json?.error ?? "AI 分析生成失败，请稍后重试");
          return;
        }
        setData(json.payload);
      } catch {
        setError("网络异常，未能获取 AI 分析结果");
      } finally {
        setLoading(false);
      }
    },
    [days, ready],
  );

  useEffect(() => {
    if (triggerMode !== "auto" || !ready || initial || autoStarted.current) {
      return;
    }
    autoStarted.current = true;
    void run(false);
  }, [triggerMode, ready, initial, run]);

  const result = data?.result ?? null;

  return (
    <section className="card mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <Sparkle size={16} weight="fill" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold">AI 分析</h2>
          <p className="mt-0.5 text-[10px] text-muted">
            {ready
              ? `${model} · 基于当前周期停机与故障数据生成研判建议`
              : "尚未启用，需管理员在系统设置中配置模型与密钥"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className="hidden font-mono text-[10px] text-muted sm:inline">
              {fmtDateTime(data.createdAt)}
              {data.cached ? " · 命中缓存" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={() => void run(Boolean(data))}
            disabled={loading || !ready}
            className={buttonClass("secondary", "sm", "h-8")}
          >
            {loading ? (
              <CircleNotch size={14} className="animate-spin" />
            ) : (
              <ArrowClockwise size={14} />
            )}
            {data ? "重新生成" : "生成分析"}
          </button>
        </div>
      </div>

      {!ready && (
        <div className="px-5 py-5">
          <p className="rounded-xl bg-paper/70 px-4 py-3 text-[12px] leading-relaxed text-muted">
            AI 分析尚未启用。
            {canConfigure
              ? "请前往「系统设置 → AI 分析」填写 DeepSeek API Key 并开启。"
              : "请联系管理员在「系统设置 → AI 分析」中配置。"}
          </p>
        </div>
      )}

      {ready && error && (
        <div className="px-5 pt-4">
          <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-[12px] leading-relaxed text-danger">
            <WarningCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        </div>
      )}

      {ready && loading && !data && (
        <div className="space-y-2 px-5 py-5" aria-busy>
          {[92, 100, 74].map((width, index) => (
            <div
              key={index}
              className="h-3 animate-pulse rounded-full bg-line/70"
              style={{ width: `${width}%` }}
            />
          ))}
          <p className="pt-2 text-[11px] text-muted">
            正在汇总指标并请求模型，通常需要 10–30 秒…
          </p>
        </div>
      )}

      {ready && !loading && !data && !error && (
        <div className="px-5 py-5">
          <p className="text-[12px] leading-relaxed text-muted">
            点击「生成分析」，AI 会结合故障次数、MTTR / MTBF、高频故障、停机最多设备、责任归属与近 14 天趋势，输出总体结论、风险点、改进动作与重点关注对象。
          </p>
          {triggerMode === "auto" && (
            <p className="mt-1.5 text-[10px] text-muted/80">
              已开启自动生成：本周期暂无可用结果，可能是模型调用失败。
            </p>
          )}
        </div>
      )}

      {data && result && (
        <div className="space-y-4 px-5 py-5">
          <p className="rounded-xl bg-paper/60 px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-soft">
            {result.summary}
          </p>

          {result.findings.length > 0 && (
            <div>
              <p className="label-mono mb-2">风险与发现</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.findings.map((item, index) => {
                  const meta = LEVEL_META[item.level] ?? LEVEL_META.medium;
                  return (
                    <div
                      key={`${item.title}-${index}`}
                      className="rounded-xl border border-line bg-surface px-3.5 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-medium leading-snug">
                          {item.title}
                        </p>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      {item.detail && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.actions.length > 0 && (
            <div>
              <p className="label-mono mb-2">建议动作</p>
              <ol className="space-y-2">
                {result.actions.map((item, index) => (
                  <li
                    key={`${item.title}-${index}`}
                    className="flex gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium leading-snug">
                        {item.title}
                      </p>
                      {item.detail && (
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.focus.length > 0 && (
            <div>
              <p className="label-mono mb-2 flex items-center gap-1.5">
                <Target size={12} /> 重点关注
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.focus.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] text-accent-ink"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="border-t border-line/70 pt-3 font-mono text-[10px] text-muted">
            {data.model}
            {data.createdByName ? ` · 生成人 ${data.createdByName}` : ""}
            {data.tokens ? ` · ${data.tokens} tokens` : ""}
            {data.durationMs ? ` · 耗时 ${(data.durationMs / 1000).toFixed(1)}s` : ""}
            {" · 结论由模型生成，请结合现场情况判断"}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <details className="border-t border-line">
          <summary className="flex cursor-pointer items-center gap-1.5 px-5 py-3 text-[11px] text-muted">
            <ClockCounterClockwise size={13} /> 历史分析 · {history.length} 条
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {history.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    setData({
                      id: item.id,
                      days: item.days,
                      summary: item.summary,
                      result: item.result ?? {
                        summary: item.summary,
                        findings: [],
                        actions: [],
                        focus: [],
                      },
                      model: item.model,
                      createdAt: item.createdAt,
                      tokens: null,
                      durationMs: 0,
                      cached: false,
                      createdByName: item.createdByName,
                    })
                  }
                  className="block w-full px-5 py-3 text-left transition-colors hover:bg-paper/60"
                >
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
                    <span className="ml-auto text-[10px] text-muted">
                      点击查看
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-soft">
                    {item.summary}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
