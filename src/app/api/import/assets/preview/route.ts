import { NextResponse, type NextRequest } from "next/server";

import { canManage, getActiveUser } from "@/lib/auth";
import { CsvLimitError, parseCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

function decodeCsv(buffer: ArrayBuffer): { text: string; encoding: "utf-8" | "gb18030" } {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(buffer),
      encoding: "utf-8",
    };
  } catch {
    try {
      return { text: new TextDecoder("gb18030").decode(buffer), encoding: "gb18030" };
    } catch {
      return { text: new TextDecoder("utf-8").decode(buffer), encoding: "utf-8" };
    }
  }
}

const CODE_KEYS = ["code", "设备编码", "编码", "资产编码"];
const NAME_KEYS = ["name", "设备名称", "名称", "资产名称"];
const CATEGORY_KEYS = ["category", "类别", "设备类别", "分类"];

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** 导入前预览：解析文件并返回行数、缺失必填与重复编码，不写库。 */
export async function POST(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "无预览权限" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "请选择 CSV 文件" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "文件超过 5MB" }, { status: 413 });
  }

  const { text, encoding } = decodeCsv(await file.arrayBuffer());

  let rows;
  try {
    rows = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvLimitError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json({ error: "文件解析失败" }, { status: 400 });
  }

  const columns = rows.length ? Object.keys(rows[0]).filter((key) => key !== "__line") : [];
  const seen = new Map<string, number>();
  let missingRequired = 0;
  let duplicates = 0;

  for (const row of rows) {
    const code = pick(row, CODE_KEYS).toUpperCase();
    if (!code || !pick(row, NAME_KEYS) || !pick(row, CATEGORY_KEYS)) {
      missingRequired += 1;
    }
    if (code) {
      const count = (seen.get(code) ?? 0) + 1;
      seen.set(code, count);
      if (count === 2) duplicates += 1;
    }
  }

  const preview = rows.slice(0, 8).map((row) => {
    const item: Record<string, string> = {};
    for (const column of columns.slice(0, 8)) {
      const value = row[column];
      item[column] = typeof value === "string" ? value.slice(0, 60) : "";
    }
    return item;
  });

  return NextResponse.json({
    ok: true,
    encoding,
    totalRows: rows.length,
    columns,
    missingRequired,
    duplicates,
    preview,
  });
}
