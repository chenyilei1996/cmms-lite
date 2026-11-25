import { and, eq, isNull, or, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { integrationEndpoints, syncJobs } from "@/db/schema";
import { audit } from "@/lib/audit";
import { optionalSecret } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/secure";
import { executeSyncJob } from "@/server/integration-engine";

export const dynamic = "force-dynamic";

function readToken(request: NextRequest) {
  return (
    request.headers.get("x-cron-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function isAuthorized(token: string) {
  if (!token) return false;
  const envToken = optionalSecret("INTEGRATION_CRON_TOKEN");
  if (envToken && safeEqual(token, envToken)) return true;
  const [row] = await db
    .select({ id: integrationEndpoints.id })
    .from(integrationEndpoints)
    .where(
      and(
        eq(integrationEndpoints.enabled, true),
        eq(integrationEndpoints.token, token),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * 定时触发同步任务：
 * GET/POST /api/integrations/cron
 * Header: x-cron-token: <INTEGRATION_CRON_TOKEN>
 * 执行所有已启用且到达建议间隔的同步任务（含拉取与推送）。
 */
async function runDueJobs(request: NextRequest) {
  const token = readToken(request);
  if (!(await isAuthorized(token))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const hit = await rateLimit("integration:cron", 30, 60);
  if (!hit.allowed) {
    return NextResponse.json(
      { error: "请求过于频繁" },
      { status: 429, headers: { "Retry-After": String(hit.retryAfterSeconds) } },
    );
  }

  const dueJobs = await db
    .select({ id: syncJobs.id, code: syncJobs.code, name: syncJobs.name })
    .from(syncJobs)
    .innerJoin(
      integrationEndpoints,
      eq(syncJobs.endpointId, integrationEndpoints.id),
    )
    .where(
      and(
        eq(syncJobs.enabled, true),
        eq(integrationEndpoints.enabled, true),
        or(
          isNull(syncJobs.lastRunAt),
          sql`${syncJobs.lastRunAt} + (${syncJobs.intervalMinutes} * interval '1 minute') <= now()`,
        ),
      ),
    );

  const results: Array<{
    code: string;
    name: string;
    ok: boolean;
    runId?: string;
    error?: string;
  }> = [];

  for (const job of dueJobs) {
    // 抢占式领取：并发调用时只有一个请求能把 lastRunAt 推进，避免重复执行
    const [claimed] = await db
      .update(syncJobs)
      .set({ lastRunAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(syncJobs.id, job.id),
          eq(syncJobs.enabled, true),
          or(
            isNull(syncJobs.lastRunAt),
            sql`${syncJobs.lastRunAt} + (${syncJobs.intervalMinutes} * interval '1 minute') <= now()`,
          ),
        ),
      )
      .returning({ id: syncJobs.id });
    if (!claimed) continue;

    try {
      const runId = await executeSyncJob(job.id, null, "cron");
      results.push({ code: job.code, name: job.name, ok: true, runId });
    } catch {
      results.push({ code: job.code, name: job.name, ok: false, error: "同步失败" });
    }
  }

  if (results.length > 0) {
    await audit({
      entityType: "integration_run",
      action: "integration.cron",
      detail: {
        due: dueJobs.length,
        executed: results.filter((row) => row.ok).length,
      },
      actorName: "定时任务",
      ip: clientIp(request),
    });
  }

  return NextResponse.json({
    ok: true,
    due: dueJobs.length,
    executed: results.filter((row) => row.ok).length,
    results,
  });
}

export async function GET(request: NextRequest) {
  return runDueJobs(request);
}

export async function POST(request: NextRequest) {
  return runDueJobs(request);
}
