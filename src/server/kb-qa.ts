import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { kbArticles } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { AiCallError, chatCompletion } from "@/lib/ai";
import { getAiRuntime } from "@/lib/ai-config";
import { KB_CATEGORIES, type KbCategory } from "@/lib/kb";
import { rateLimit } from "@/lib/rate-limit";

export type KbQaSource = {
  id: string;
  code: string;
  title: string;
  category: KbCategory;
  categoryLabel: string;
};

export type KbQaPayload = {
  question: string;
  answer: string;
  sources: KbQaSource[];
  followUps: string[];
  model: string;
  tokens: number | null;
  durationMs: number;
};

export type KbQaOutcome =
  | { ok: true; payload: KbQaPayload }
  | {
      ok: false;
      code: "unconfigured" | "empty" | "rate_limited" | "model_error";
      message: string;
      retryAfterSeconds?: number;
    };

type Candidate = {
  id: string;
  code: string;
  title: string;
  summary: string | null;
  content: string;
  tags: string;
  category: KbCategory;
  score: number;
};

const SYSTEM_PROMPT = `你是工厂设备维修知识库的问答助手，服务对象是一线维修工程师。
必须遵守：
1. 只依据【资料】回答，不得编造资料之外的备件型号、参数、周期或安全要求。
2. 资料不足以回答时，直接说明知识库中没有足够依据，并指出还需要补充哪些信息（设备型号、现象、报警代码等）。
3. 回答具体可执行，步骤用 1. 2. 3. 编号；先说结论或安全提示，再给做法。
4. 使用简体中文，不要使用 Markdown 符号（如 **、#、\`），不要编造资料编号。
5. 只输出 JSON，结构为：
{"answer":"回答正文","cited":[用到的资料序号],"followUps":["可以继续追问的问题"]}
cited 为资料列表中出现的数字序号，可为空数组；followUps 0-3 条，每条不超过 20 字。`;

const QUESTION_MAX = 200;
const CONTEXT_MAX = 200;
const CONTENT_LIMIT = 900;

function splitTerms(question: string) {
  const parts = question
    .toLowerCase()
    .split(/[\s，。？！、；：,.?!;:()（）[\]“”"'‘’/\\-]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const terms = new Set<string>();
  for (const part of parts) {
    terms.add(part);
    // 中文没有空格分隔，补 2 字组合提升召回
    if (part.length >= 3 && /[\u4e00-\u9fa5]/.test(part)) {
      for (let i = 0; i < part.length - 1; i += 1) {
        terms.add(part.slice(i, i + 2));
      }
    }
  }
  return Array.from(terms);
}

function scoreArticle(
  row: {
    title: string;
    summary: string | null;
    content: string;
    tags: string;
  },
  terms: string[],
  question: string,
) {
  const title = row.title.toLowerCase();
  const summary = (row.summary ?? "").toLowerCase();
  const content = row.content.toLowerCase();
  const tags = row.tags.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 6;
    else if (tags.includes(term)) score += 4;
    else if (summary.includes(term)) score += 2;
    else if (content.includes(term)) score += 1;
  }
  if (title.includes(question.toLowerCase())) score += 4;
  return score;
}

async function retrieve(question: string): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: kbArticles.id,
      code: kbArticles.code,
      title: kbArticles.title,
      summary: kbArticles.summary,
      content: kbArticles.content,
      tags: kbArticles.tags,
      category: kbArticles.category,
    })
    .from(kbArticles)
    .where(eq(kbArticles.status, "published"))
    .orderBy(desc(kbArticles.helpfulCount), desc(kbArticles.views))
    .limit(120);

  const terms = splitTerms(question);
  return rows
    .map((row) => ({
      ...row,
      category: row.category as KbCategory,
      score: scoreArticle(row, terms, question),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function buildUserPrompt(
  question: string,
  candidates: Candidate[],
  context: string,
) {
  const materials = candidates
    .map((item, index) => {
      const category = KB_CATEGORIES[item.category]?.label ?? item.category;
      return [
        `[${index + 1}] ${item.title}（${category}｜编号 ${item.code}）`,
        item.summary ? `摘要：${item.summary}` : "",
        `正文节选：${item.content.replace(/\s+/g, " ").slice(0, CONTENT_LIMIT)}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `【问题】${question}\n${context ? `\n【当前工单背景】${context}\n` : ""}\n【资料】\n${materials}`;
}

function parseAnswer(
  raw: string,
): { answer: string; cited: number[]; followUps: string[] } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const textOf = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

  try {
    const json = JSON.parse(cleaned) as Record<string, unknown>;
    const answer = textOf(json.answer, 2000);
    if (!answer) throw new Error("empty answer");
    const cited = Array.isArray(json.cited)
      ? json.cited
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0)
          .slice(0, 6)
      : [];
    const followUps = Array.isArray(json.followUps)
      ? json.followUps
          .map((item) => textOf(item, 24))
          .filter(Boolean)
          .slice(0, 3)
      : [];
    return { answer, cited, followUps };
  } catch {
    return { answer: cleaned.slice(0, 2000), cited: [], followUps: [] };
  }
}

/**
 * 知识库问答：先按关键词粗排召回，再让模型结合资料作答。
 * 未配置、无相关资料、命中拒绝限额都不消耗 limiter 配额。
 */
export async function answerKbQuestion({
  question,
  user,
  context,
}: {
  question: string;
  user: SessionUser;
  context?: string;
}): Promise<KbQaOutcome> {
  const q = question.trim().slice(0, QUESTION_MAX);
  const background = (context ?? "").trim().slice(0, CONTEXT_MAX);
  if (q.length < 2) {
    return { ok: false, code: "empty", message: "请输入要咨询的问题（至少 2 个字）" };
  }

  const runtime = await getAiRuntime();
  if (!runtime) {
    return {
      ok: false,
      code: "unconfigured",
      message: "知识问答尚未启用，请联系管理员在系统设置中配置 AI 模型",
    };
  }

  const candidates = await retrieve(background ? `${q} ${background}` : q);
  if (candidates.length === 0) {
    return {
      ok: false,
      code: "empty",
      message:
        "知识库中暂未找到与该问题相关的已发布内容，可换个说法（设备类型、现象、报警代码）再问，或先在知识库中搜索。",
    };
  }

  const limit = await rateLimit(`ai:kbqa:${user.id}`, 20, 600);
  if (!limit.allowed) {
    return {
      ok: false,
      code: "rate_limited",
      message: `提问过于频繁（10 分钟内最多 20 次），请 ${limit.retryAfterSeconds} 秒后再试`,
      retryAfterSeconds: limit.retryAfterSeconds,
    };
  }

  const startedAt = Date.now();
  try {
    const { text, promptTokens, completionTokens } = await chatCompletion({
      baseUrl: runtime.config.baseUrl,
      apiKey: runtime.apiKey,
      model: runtime.config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(q, candidates, background) },
      ],
      maxTokens: 1200,
      timeoutMs: 40000,
    });

    const parsed = parseAnswer(text);
    const sources: KbQaSource[] = parsed.cited.length
      ? parsed.cited
          .map((index) => candidates[index - 1])
          .filter((item): item is Candidate => Boolean(item))
          .map((item) => ({
            id: item.id,
            code: item.code,
            title: item.title,
            category: item.category,
            categoryLabel: KB_CATEGORIES[item.category]?.label ?? item.category,
          }))
      : candidates.map((item) => ({
          id: item.id,
          code: item.code,
          title: item.title,
          category: item.category,
          categoryLabel: KB_CATEGORIES[item.category]?.label ?? item.category,
        }));

    const tokens =
      promptTokens === null && completionTokens === null
        ? null
        : (promptTokens ?? 0) + (completionTokens ?? 0);

    return {
      ok: true,
      payload: {
        question: q,
        answer: parsed.answer,
        sources,
        followUps: parsed.followUps,
        model: runtime.config.model,
        tokens,
        durationMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const message =
      error instanceof AiCallError
        ? error.message
        : "知识问答调用失败，请稍后重试";
    console.error("kb qa failed", error);
    return { ok: false, code: "model_error", message };
  }
}
