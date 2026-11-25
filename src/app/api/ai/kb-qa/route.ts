import { NextResponse } from "next/server";
import { z } from "zod";

import { getActiveUser } from "@/lib/auth";
import { answerKbQuestion } from "@/server/kb-qa";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().trim().min(2).max(200),
  context: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "登录已失效，请重新登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "请输入 2–200 字的有效问题" },
      { status: 400 },
    );
  }

  const outcome = await answerKbQuestion({
    question: parsed.data.question,
    context: parsed.data.context,
    user,
  });

  if (outcome.ok) {
    return NextResponse.json({ payload: outcome.payload });
  }

  if (outcome.code === "rate_limited") {
    return NextResponse.json(
      { error: outcome.message, code: outcome.code },
      {
        status: 429,
        headers: { "Retry-After": String(outcome.retryAfterSeconds ?? 60) },
      },
    );
  }

  const status =
    outcome.code === "unconfigured"
      ? 409
      : outcome.code === "empty"
        ? 404
        : 502;
  return NextResponse.json(
    { error: outcome.message, code: outcome.code },
    { status },
  );
}
