import { createHash } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { auditLogs, integrationEndpoints } from "@/db/schema";
import { audit } from "@/lib/audit";
import { optionalSecret } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/secure";
import { upsertAssetRows, type AssetImportRow } from "@/server/asset-sync";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 500;

function readKey(request: NextRequest) {
  return (
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function isAuthorized(key: string) {
  if (!key) return false;
  const envToken = optionalSecret("INTEGRATION_ASSET_TOKEN");
  if (envToken && safeEqual(key, envToken)) return true;
  const [row] = await db
    .select({ id: integrationEndpoints.id })
    .from(integrationEndpoints)
    .where(
      and(
        eq(integrationEndpoints.enabled, true),
        eq(integrationEndpoints.token, key),
      ),
    )
    .limit(1);
  return Boolean(row);
}

function toRow(item: Record<string, unknown>, index: number): AssetImportRow {
  const row: AssetImportRow = { __line: index + 1 };
  for (const [key, value] of Object.entries(item)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      row[key] = JSON.stringify(value);
    } else {
      row[key] = String(value);
    }
  }
  return row;
}

/** 幂等结果保存在 audit_logs，24 小时内同一 Idempotency-Key 直接回放。 */
async function findIdempotent(key: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [row] = await db
    .select({ detail: auditLogs.detail })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "asset.api.idempotent"),
        gte(auditLogs.createdAt, since),
        sql`${auditLogs.detail}->>'key' = ${key}`,
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  const detail = row?.detail as { result?: unknown } | null | undefined;
  return detail?.result ?? null;
}

/**
 * 三方系统推送设备主数据：
 * POST /api/integrations/assets
 * Header: x-api-key: <集成端点令牌 或 INTEGRATION_ASSET_TOKEN>
 *         Idempotency-Key: <可选，同一批次重试时回放首次结果>
 * Body: { "items": [{ "code": "...", "name": "...", "category": "..." }] }
 */
export async function POST(request: NextRequest) {
  const key = readKey(request);
  if (!(await isAuthorized(key))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const hit = await rateLimit(
    `integration:assets:${createHash("sha256").update(key).digest("hex").slice(0, 16)}`,
    60,
    60,
  );
  if (!hit.allowed) {
    return NextResponse.json(
      { error: "请求过于频繁" },
      { status: 429, headers: { "Retry-After": String(hit.retryAfterSeconds) } },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (idempotencyKey) {
    const cached = await findIdempotent(idempotencyKey);
    if (cached) {
      return NextResponse.json({ ok: true, replayed: true, result: cached });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const rawItems = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
      ? ((body as { items: unknown[] }).items)
      : body && typeof body === "object"
        ? [body]
        : [];

  if (rawItems.length === 0) {
    return NextResponse.json(
      { error: "没有可导入的设备数据，请提供 items 数组或单个设备对象" },
      { status: 400 },
    );
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `单次最多推送 ${MAX_ITEMS} 条设备` },
      { status: 413 },
    );
  }

  const mode =
    request.nextUrl.searchParams.get("mode") === "insert_only" ||
    (body as { mode?: unknown })?.mode === "insert_only"
      ? "insert_only"
      : "upsert";

  const rows: AssetImportRow[] = [];
  rawItems.forEach((item, index) => {
    if (item && typeof item === "object") {
      rows.push(toRow(item as Record<string, unknown>, index));
    }
  });

  try {
    const result = await upsertAssetRows(rows, {
      source: "api",
      actor: null,
      mode,
      ip: clientIp(request),
    });

    if (idempotencyKey) {
      await audit({
        entityType: "asset",
        action: "asset.api.idempotent",
        detail: { key: idempotencyKey, result },
        ip: clientIp(request),
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "写入失败，请稍后重试" }, { status: 500 });
  }
}

/** 返回接口字段说明，方便三方对接自检；同样需要令牌。 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorized(readKey(request)))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  return NextResponse.json({
    endpoint: "POST /api/integrations/assets",
    header: {
      "x-api-key": "<集成端点令牌>",
      "Idempotency-Key": "<可选，重试时回放首次结果>",
    },
    query: { mode: "upsert（默认） | insert_only（仅新建，跳过已存在）" },
    body: {
      items: [
        {
          code: "AZ-1001",
          name: "冲压机 A 线",
          category: "冲压设备",
          level: "machine",
          status: "in_service",
          criticality: "A",
          parentCode: "AZ-1000",
          locationCode: "LOC-001",
          manufacturer: "江苏锻压",
          model: "JC21-160",
          serialNo: "SN2024001",
          purchaseDate: "2024-03-01",
          purchaseCost: 560000,
        },
      ],
    },
    note: "按 code 匹配：已存在则覆盖有值字段，不存在则建档；单次最多 500 条。",
  });
}
