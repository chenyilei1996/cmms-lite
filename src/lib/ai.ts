import type { AiAnalysisResult, AiFindingLevel } from "@/db/schema";

export const AI_DEFAULT_BASE_URL = "https://api.deepseek.com";
export const AI_DEFAULT_MODEL = "deepseek-chat";
export const AI_TRIGGER_MODES = ["manual", "auto"] as const;
export type AiTriggerMode = (typeof AI_TRIGGER_MODES)[number];

export type AiAnalysisPayload = {
  id: string;
  days: number;
  summary: string;
  result: AiAnalysisResult;
  model: string;
  createdAt: string;
  tokens: number | null;
  durationMs: number;
  cached: boolean;
  createdByName: string | null;
};

export type AiHistoryItem = {
  id: string;
  days: number;
  summary: string;
  result: AiAnalysisResult | null;
  model: string;
  createdAt: string;
  createdByName: string | null;
};

export class AiCallError extends Error {
  readonly httpStatus?: number;

  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "AiCallError";
    this.httpStatus = httpStatus;
  }
}

function friendlyStatus(status: number) {
  if (status === 401 || status === 403) return "API Key 无效或没有模型权限";
  if (status === 402) return "模型账户余额不足，请充值后重试";
  if (status === 404) return "接口地址或模型名称不正确";
  if (status === 429) return "模型调用频率超限，请稍后重试";
  if (status >= 500) return "模型服务暂时不可用，请稍后重试";
  return `模型接口返回异常（${status}）`;
}

/** 允许管理员填写根地址或带 /v1 的地址，统一拼成 chat/completions。 */
function endpointOf(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  return `${base}/chat/completions`;
}

export type ChatMessage = { role: "system" | "user"; content: string };

export async function chatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  maxTokens = 1800,
  timeoutMs = 45000,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{
  text: string;
  promptTokens: number | null;
  completionTokens: number | null;
}> {
  let response: Response;
  const attempt = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(endpointOf(baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          stream: false,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    response = await attempt();
  } catch (error) {
    const retryable =
      error instanceof Error &&
      error.name !== "TimeoutError" &&
      error.name !== "AbortError" &&
      ((error as { cause?: { code?: string } }).cause?.code === "EAI_AGAIN" ||
        (error as { cause?: { code?: string } }).cause?.code === "ENOTFOUND" ||
        (error as { cause?: { code?: string } }).cause?.code === "ECONNRESET" ||
        (error as { cause?: { code?: string } }).cause?.code === "ECONNREFUSED");
    if (retryable) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        response = await attempt();
      } catch (retryError) {
        console.error(
          "ai chat request failed after retry",
          retryError instanceof Error ? `${retryError.name}: ${retryError.message}` : retryError,
          (retryError as { cause?: unknown })?.cause,
        );
        throw new AiCallError("无法连接模型服务，请检查网络或接口地址");
      }
    } else {
      console.error(
        "ai chat request failed",
        error instanceof Error ? `${error.name}: ${error.message}` : error,
        (error as { cause?: unknown })?.cause,
      );
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new AiCallError("模型响应超时，请稍后重试");
      }
      throw new AiCallError("无法连接模型服务，请检查网络或接口地址");
    }
  }

  if (!response.ok) {
    // 原始响应只进日志，不返回给前端，避免泄露上游细节
    const detail = await response.text().catch(() => "");
    console.error("ai chat completion failed", response.status, detail.slice(0, 500));
    throw new AiCallError(friendlyStatus(response.status), response.status);
  }

  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiCallError("模型返回内容为空，请重试");

  return {
    text,
    promptTokens: data?.usage?.prompt_tokens ?? null,
    completionTokens: data?.usage?.completion_tokens ?? null,
  };
}

const LEVELS: AiFindingLevel[] = ["high", "medium", "low"];

function textOf(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * 模型被要求输出 JSON，但仍可能出现代码块包裹或字段缺失。
 * 解析失败时降级为纯文本摘要，保证页面始终有内容可展示。
 */
export function parseAnalysis(raw: string): {
  result: AiAnalysisResult;
  parsed: boolean;
} {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const json = JSON.parse(cleaned) as Record<string, unknown>;
    const summary = textOf(json.summary, 1200);
    if (!summary) throw new Error("empty summary");

    const findings = Array.isArray(json.findings)
      ? json.findings
          .slice(0, 6)
          .flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            const title = textOf(row.title, 80);
            const detail = textOf(row.detail, 300);
            if (!title && !detail) return [];
            const level = LEVELS.includes(row.level as AiFindingLevel)
              ? (row.level as AiFindingLevel)
              : "medium";
            return [{ title, detail, level }];
          })
      : [];

    const actions = Array.isArray(json.actions)
      ? json.actions
          .slice(0, 6)
          .flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            const title = textOf(row.title, 80);
            const detail = textOf(row.detail, 300);
            if (!title && !detail) return [];
            return [{ title, detail }];
          })
      : [];

    const focus = Array.isArray(json.focus)
      ? json.focus
          .map((item) => textOf(item, 60))
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return { result: { summary, findings, actions, focus }, parsed: true };
  } catch {
    return {
      result: {
        summary: cleaned.slice(0, 2000),
        findings: [],
        actions: [],
        focus: [],
      },
      parsed: false,
    };
  }
}
