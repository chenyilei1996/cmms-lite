import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiAnalyses, type AiAnalysis } from "@/db/schema";
import { audit } from "@/lib/audit";
import { isAdmin, type SessionUser } from "@/lib/auth";
import {
  AiCallError,
  chatCompletion,
  parseAnalysis,
  type AiAnalysisPayload,
  type AiHistoryItem,
} from "@/lib/ai";
import { getAiConfig, getAiRuntime } from "@/lib/ai-config";
import { rateLimit } from "@/lib/rate-limit";
import { RESPONSIBILITY } from "@/lib/constants";
import { loadFaultsAnalytics, type FaultsAnalytics } from "./faults-analytics";

/** 同一周期数据指纹在 24 小时内复用结论，避免重复消耗 token。 */
const CACHE_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `你是资深设备可靠性工程师，熟悉 CMMS / TPM / 故障停机分析，负责为工厂设备主管撰写停机分析简报。
必须遵守：
1. 只依据给定统计数据判断，不得编造未出现的设备、故障代码或数值；引用数字必须与数据一致。
2. 结论要具体可执行，优先指出高频故障、停机时长集中的设备、责任归属异常和近 14 天趋势。
3. 数据量过少时直接说明样本不足，避免过度推断。
4. 使用简体中文，语气客观简练，不要使用 Markdown 语法。
5. 只输出 JSON，结构为：
{"summary":"2-4 句总体结论","findings":[{"title":"问题标题","detail":"数据依据与影响","level":"high|medium|low"}],"actions":[{"title":"动作标题","detail":"负责人/周期/验证方式"}],"focus":["需重点关注的设备或故障代码"]}
findings 3-5 条，actions 3-5 条，focus 3-6 条。`;

function minutes(value: number) {
  if (value < 60) return `${value} 分钟`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

/** 只把与判断相关的聚合指标发给模型，不包含设备主数据、人员等敏感明细。 */
function buildContext(analytics: FaultsAnalytics) {
  const available = analytics.days * 24 * 60 * analytics.machineCount;
  return {
    统计周期: `近 ${analytics.days} 天`,
    纳入统计设备台数: analytics.machineCount,
    非计划故障次数: analytics.faultCount,
    总停机时长: minutes(analytics.totalMinutes),
    非计划停机时长: minutes(analytics.unplannedMinutes),
    计划停机时长: minutes(Math.max(0, analytics.totalMinutes - analytics.unplannedMinutes)),
    MTTR: analytics.mttr === null ? "无数据" : minutes(analytics.mttr),
    MTBF: analytics.mtbfHours === null
      ? "无数据"
      : `${Math.round(analytics.mtbfHours)} 小时`,
    影响产量: analytics.affectedTotal,
    估算可用率:
      analytics.faultCount === 0
        ? "无故障"
        : `${(((available - analytics.unplannedMinutes) / available) * 100).toFixed(1)}%`,
    高频故障TOP: analytics.topCodes.map((item) => ({
      故障代码: item.code,
      故障名称: item.name,
      次数: item.count,
      累计停机: minutes(item.minutes),
    })),
    停机最多设备TOP: analytics.topAssets.map((item) => ({
      设备编码: item.code,
      设备名称: item.name,
      次数: item.count,
      累计停机: minutes(item.minutes),
    })),
    责任归属分布: [...analytics.responsibilityStats.entries()].map(
      ([key, stat]) => ({
        归属: RESPONSIBILITY[key]?.label ?? key,
        次数: stat.count,
        累计停机: minutes(stat.minutes),
      }),
    ),
    近14天停机分钟: analytics.trend.map((item) => ({
      日期: item.label,
      停机分钟: item.minutes,
      故障次数: item.count,
    })),
    最近工单: analytics.woRows.slice(0, 12).map((item) => ({
      工单号: item.code,
      标题: item.title,
      设备: item.assetName,
    })),
  };
}

function tokensOf(row: AiAnalysis) {
  const total =
    (row.promptTokens ?? 0) + (row.completionTokens ?? 0);
  return total > 0 ? total : null;
}

function toPayload(
  row: AiAnalysis,
  cached: boolean,
  days: number,
): AiAnalysisPayload {
  return {
    id: row.id,
    days,
    summary: row.summary,
    result: row.result ?? {
      summary: row.summary,
      findings: [],
      actions: [],
      focus: [],
    },
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    tokens: tokensOf(row),
    durationMs: row.durationMs ?? 0,
    cached,
    createdByName: row.createdByName,
  };
}

function toHistory(row: AiAnalysis): AiHistoryItem {
  return {
    id: row.id,
    days: row.days,
    summary: row.summary,
    result: row.result,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdByName,
  };
}

export type AiRunOutcome =
  | { ok: true; payload: AiAnalysisPayload }
  | { ok: false; code: "unconfigured" | "empty" | "failed"; message: string }
  | {
      ok: false;
      code: "rate_limited";
      message: string;
      retryAfterSeconds: number;
    };

export async function runFaultsAiAnalysis({
  days,
  refresh,
  user,
  ip,
}: {
  days: number;
  refresh: boolean;
  user: SessionUser;
  ip?: string | null;
}): Promise<AiRunOutcome> {
  const runtime = await getAiRuntime();
  if (!runtime) {
    return {
      ok: false,
      code: "unconfigured",
      message: "管理员尚未启用 AI 分析或未配置 API Key",
    };
  }

  const analytics = await loadFaultsAnalytics(days);
  if (analytics.faultCount === 0 && analytics.totalMinutes === 0) {
    return {
      ok: false,
      code: "empty",
      message: "当前周期没有停机记录，暂不需要 AI 分析",
    };
  }

  if (!refresh) {
    const [cached] = await db
      .select()
      .from(aiAnalyses)
      .where(
        and(
          eq(aiAnalyses.scope, "faults"),
          eq(aiAnalyses.days, days),
          eq(aiAnalyses.fingerprint, analytics.fingerprint),
        ),
      )
      .orderBy(desc(aiAnalyses.createdAt))
      .limit(1);
    if (cached && Date.now() - cached.createdAt.getTime() < CACHE_MS) {
      return { ok: true, payload: toPayload(cached, true, days) };
    }
  }

  // 只在真正调用模型前计数：未配置、无数据、命中缓存都不消耗配额
  const limit = await rateLimit(`ai:faults:${user.id}`, 10, 600);
  if (!limit.allowed) {
    return {
      ok: false,
      code: "rate_limited",
      message: `生成过于频繁（10 分钟内最多 10 次），请 ${limit.retryAfterSeconds} 秒后再试`,
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
        {
          role: "user",
          content: `以下是${days}天周期内的停机与故障统计：\n${JSON.stringify(
            buildContext(analytics),
            null,
            2,
          )}`,
        },
      ],
    });
    const { result } = parseAnalysis(text);
    const durationMs = Date.now() - startedAt;

    const [row] = await db
      .insert(aiAnalyses)
      .values({
        scope: "faults",
        days,
        fingerprint: analytics.fingerprint,
        model: runtime.config.model,
        summary: result.summary,
        result,
        raw: text,
        promptTokens,
        completionTokens,
        durationMs,
        createdById: user.id,
        createdByName: user.name,
      })
      .returning();

    await audit({
      entityType: "ai_analysis",
      entityId: row.id,
      action: "ai.analysis.generate",
      detail: {
        days,
        model: runtime.config.model,
        promptTokens,
        completionTokens,
        cached: false,
      },
      actorId: user.id,
      actorName: user.name,
      ip,
    });

    void pruneHistory();

    return { ok: true, payload: toPayload(row, false, days) };
  } catch (error) {
    console.error("faults ai analysis failed", error);
    return {
      ok: false,
      code: "failed",
      message:
        error instanceof AiCallError
          ? error.message
          : "AI 分析生成失败，请稍后重试",
    };
  }
}

/** 历史只保留最近 100 条，避免表无限增长；失败不影响主流程。 */
async function pruneHistory() {
  try {
    await db.execute(sql`
      delete from ai_analyses where id in (
        select id from ai_analyses where scope = 'faults'
        order by created_at desc offset 100
      )
    `);
  } catch (error) {
    console.error("prune ai history failed", error);
  }
}

export async function getAiPanelData(
  days: number,
  fingerprint: string,
  user: SessionUser,
) {
  const [config, rows] = await Promise.all([
    getAiConfig(),
    db
      .select()
      .from(aiAnalyses)
      .where(and(eq(aiAnalyses.scope, "faults"), eq(aiAnalyses.days, days)))
      .orderBy(desc(aiAnalyses.createdAt))
      .limit(6),
  ]);

  const cached = rows.find(
    (row) =>
      row.fingerprint === fingerprint &&
      Date.now() - row.createdAt.getTime() < CACHE_MS,
  );

  return {
    ready: config.enabled && config.hasKey,
    model: config.model,
    triggerMode: config.triggerMode,
    canConfigure: isAdmin(user.role),
    initial: cached ? toPayload(cached, true, days) : null,
    history: rows.map(toHistory),
  };
}

export async function getAiHistory(limit = 10) {
  const rows = await db
    .select()
    .from(aiAnalyses)
    .where(eq(aiAnalyses.scope, "faults"))
    .orderBy(desc(aiAnalyses.createdAt))
    .limit(limit);
  return rows.map(toHistory);
}
