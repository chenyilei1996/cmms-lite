import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function getClientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "unknown";
}

/**
 * 固定窗口限流。数据库异常时放行，避免限流故障阻断正常报修。
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const result = await db.execute(sql`
      insert into rate_limits ("key", "count", "window_start")
      values (${key}, 1, now())
      on conflict ("key") do update set
        "count" = case
          when rate_limits."window_start" < now() - make_interval(secs => ${windowSeconds})
          then 1
          else rate_limits."count" + 1
        end,
        "window_start" = case
          when rate_limits."window_start" < now() - make_interval(secs => ${windowSeconds})
          then now()
          else rate_limits."window_start"
        end
      returning "count", "window_start"
    `);

    const rows = result as unknown as {
      count: number;
      window_start: string;
    }[];
    const row = rows[0];
    const count = Number(row?.count ?? 1);
    const startedAt = row?.window_start ? new Date(row.window_start) : new Date();
    const elapsed = (Date.now() - startedAt.getTime()) / 1000;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(windowSeconds - Math.min(elapsed, windowSeconds)),
    );

    if (Math.random() < 0.02) {
      await db.execute(
        sql`delete from rate_limits where "window_start" < now() - interval '1 day'`,
      );
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds,
    };
  } catch (error) {
    console.error("rate limit check failed", error);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}
