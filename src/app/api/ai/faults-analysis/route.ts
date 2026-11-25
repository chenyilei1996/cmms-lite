import { NextResponse } from "next/server";
import { z } from "zod";
import { canRepair, getActiveUser } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";
import { runFaultsAiAnalysis } from "@/server/ai-analysis";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  days: z.union([z.literal(30), z.literal(90), z.literal(365)]),
  refresh: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json(
      { error: "登录已失效，请重新登录" },
      { status: 401 },
    );
  }
  if (!canRepair(user.role)) {
    return NextResponse.json(
      { error: "当前角色无 AI 分析权限" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "统计周期不合法" }, { status: 400 });
  }

  // 限流在服务层执行：只有真正调用模型时才计数，复用缓存不消耗配额
  const outcome = await runFaultsAiAnalysis({
    days: parsed.data.days,
    refresh: parsed.data.refresh ?? false,
    user,
    ip: await getClientIp(),
  });

  if (outcome.ok) {
    return NextResponse.json({ payload: outcome.payload });
  }

  if (outcome.code === "rate_limited") {
    return NextResponse.json(
      { error: outcome.message, code: outcome.code },
      {
        status: 429,
        headers: { "Retry-After": String(outcome.retryAfterSeconds) },
      },
    );
  }

  const status =
    outcome.code === "unconfigured" ? 409 : outcome.code === "empty" ? 400 : 502;
  return NextResponse.json(
    { error: outcome.message, code: outcome.code },
    { status },
  );
}
