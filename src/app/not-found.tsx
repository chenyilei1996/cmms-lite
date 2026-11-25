import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="label-mono">404 NOT FOUND</p>
        <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em]">
          没有找到这个页面
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          链接可能已失效，或者对应的设备、工单已被删除。
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/app/dashboard"
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[13px] font-medium text-white"
          >
            回工作台
          </Link>
          <Link
            href="/app/assets"
            className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-[13px] font-medium"
          >
            设备台账
          </Link>
        </div>
      </div>
    </main>
  );
}
