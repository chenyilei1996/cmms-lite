import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { canManage, getActiveUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type Issue = { line?: number; code?: string; message?: string };

/** 下载最近一次导入的失败明细，便于逐行修正后重试。 */
export async function GET() {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "无导出权限" }, { status: 403 });
  }

  const [last] = await db
    .select({ detail: auditLogs.detail, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(eq(auditLogs.action, "asset.import"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  const detail = (last?.detail ?? null) as { errors?: Issue[] } | null;
  const errors = detail?.errors ?? [];
  if (errors.length === 0) {
    return NextResponse.json({ error: "最近一次导入没有失败记录" }, { status: 404 });
  }

  const rows: Array<Array<string | number>> = errors.map((item) => [
    item.line ?? "",
    item.code ?? "",
    item.message ?? "",
  ]);
  const csv = toCsv(["行号", "设备编码", "失败原因"], rows);
  const date = last?.createdAt
    ? `${last.createdAt.getFullYear()}${String(last.createdAt.getMonth() + 1).padStart(2, "0")}${String(
        last.createdAt.getDate(),
      ).padStart(2, "0")}`
    : "latest";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asset-import-failures-${date}.csv"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
