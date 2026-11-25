"use client";

import { CircleNotch, Plug } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./ui";

export function AiTestButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function test() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/ai/test", { method: "POST" });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        models?: number;
        model?: string;
        error?: string;
      } | null;
      if (response.ok && json?.ok) {
        setResult({
          ok: true,
          message: `连接成功，可用模型 ${json.models ?? 0} 个，当前模型 ${json.model ?? "—"}`,
        });
      } else {
        setResult({ ok: false, message: json?.error ?? "连通性测试失败" });
      }
    } catch {
      setResult({ ok: false, message: "网络异常，测试失败" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={test}
        disabled={loading}
        className={buttonClass("secondary", "sm", "h-9")}
      >
        {loading ? (
          <CircleNotch className="size-3.5 animate-spin" />
        ) : (
          <Plug className="size-3.5" />
        )}
        测试连通性
      </button>
      {result && (
        <span
          className={cn(
            "text-[11px]",
            result.ok ? "text-mint" : "text-danger",
          )}
        >
          {result.message}
        </span>
      )}
    </div>
  );
}
