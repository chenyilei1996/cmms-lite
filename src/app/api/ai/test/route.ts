import { NextResponse } from "next/server";
import { getActiveUser, isAdmin } from "@/lib/auth";
import { getAiRuntime } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

/** 管理员保存配置后用它验证地址与密钥是否可用，只请求模型列表，不产生推理费用。 */
export async function POST() {
  const user = await getActiveUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "仅管理员可测试连通性" }, { status: 403 });
  }

  const runtime = await getAiRuntime();
  if (!runtime) {
    return NextResponse.json(
      { error: "请先启用 AI 分析并保存 API Key" },
      { status: 409 },
    );
  }

  const base = runtime.config.baseUrl.trim().replace(/\/+$/, "");
  try {
    const response = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${runtime.apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "API Key 无效或没有模型权限" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: `接口返回异常（${response.status}）` },
        { status: 400 },
      );
    }
    const data = (await response.json().catch(() => null)) as {
      data?: unknown[];
    } | null;
    return NextResponse.json({
      ok: true,
      models: Array.isArray(data?.data) ? data.data.length : 0,
      model: runtime.config.model,
    });
  } catch (error) {
    console.error("ai connectivity test failed", error);
    return NextResponse.json(
      { error: "无法连接模型服务，请检查网络与接口地址" },
      { status: 502 },
    );
  }
}
