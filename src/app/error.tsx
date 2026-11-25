"use client";

import Link from "next/link";
import { ArrowClockwise, House } from "@phosphor-icons/react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="label-mono">ERROR</p>
        <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em]">
          这里出了点问题
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          页面加载时发生异常，已自动记录。你可以重试，或回到工作台继续其他操作。
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-muted/70">
            错误编号：{error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-medium text-white"
          >
            <ArrowClockwise className="size-4" /> 重试
          </button>
          <Link
            href="/app/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[13px] font-medium"
          >
            <House className="size-4" /> 回工作台
          </Link>
        </div>
      </div>
    </main>
  );
}
