import { LoginForm } from "./login-form";

export const metadata = { title: "登录" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const showDemo =
    process.env.NODE_ENV !== "production" ||
    process.env.SHOW_DEMO_ACCOUNTS === "true";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute -right-24 top-1/3 size-[420px] rounded-full bg-accent-on-dark/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-on-dark text-[15px] font-bold text-ink">
            M
          </span>
          <div>
            <p className="text-[14px] font-medium">设备管理</p>
            <p className="font-mono text-[10px] tracking-[0.18em] text-white/40">
              YUELI · CMMS
            </p>
          </div>
        </div>

        <div className="relative max-w-[460px]">
          <p className="label-mono mb-5 text-white/40">设备全生命周期</p>
          <h1 className="text-[42px] font-semibold leading-[1.12] tracking-[-0.03em]">
            让每一台设备，
            <br />
            <span className="text-accent-on-dark">都有迹可循。</span>
          </h1>
          <p className="mt-6 text-[14px] leading-relaxed text-white/55">
            台账、扫码报修、维修工单与巡检保养收在同一个地方。
            现场用手机，办公室用电脑，数据实时同步。
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          <div>
            <p className="font-mono text-[26px] tracking-tight">4</p>
            <p className="mt-1 text-[11px] text-white/45">核心流程闭环</p>
          </div>
          <div>
            <p className="font-mono text-[26px] tracking-tight">30s</p>
            <p className="mt-1 text-[11px] text-white/45">扫码完成报修</p>
          </div>
          <div>
            <p className="font-mono text-[26px] tracking-tight">100%</p>
            <p className="mt-1 text-[11px] text-white/45">私有化部署</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-[15px] font-bold text-accent-on-dark">
              M
            </span>
            <div>
              <p className="text-[14px] font-semibold">设备管理</p>
              <p className="font-mono text-[10px] tracking-[0.18em] text-muted">
                YUELI · CMMS
              </p>
            </div>
          </div>

          <p className="label-mono mb-2">Welcome back</p>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">登录工作台</h2>
          <p className="mt-2 text-[13px] text-muted">
            使用内部账号登录，扫码报修入口无需登录。
          </p>

          <LoginForm next={next} showDemo={showDemo} />
        </div>
      </section>
    </main>
  );
}
