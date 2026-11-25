"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canManage, requireUser } from "@/lib/auth";
import { CsvLimitError, parseCsv } from "@/lib/csv";
import { getClientIp } from "@/lib/rate-limit";
import { upsertAssetRows } from "@/server/asset-sync";

const MAX_BYTES = 5 * 1024 * 1024;

/** 优先按 UTF-8 严格解码；失败时回退 GB18030，兼容 Excel 导出的中文 CSV。 */
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

/** 后台 CSV 批量导入设备主档：按设备编码 upsert。 */
export async function importAssetsCsv(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) {
    redirect("/admin/assets/import?error=forbidden");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/assets/import?error=empty");
  }
  if (file.size > MAX_BYTES) {
    redirect("/admin/assets/import?error=too-large");
  }

  const { text, encoding } = decodeCsv(await file.arrayBuffer());

  let rows;
  try {
    rows = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvLimitError) {
      redirect("/admin/assets/import?error=too-many");
    }
    redirect("/admin/assets/import?error=parse");
  }
  if (rows.length === 0) {
    redirect("/admin/assets/import?error=norows");
  }

  const mode = formData.get("mode") === "insert_only" ? "insert_only" : "upsert";
  const ip = await getClientIp();

  await upsertAssetRows(rows, {
    source: "csv",
    actor: { id: user.id, name: user.name },
    mode,
    ip,
  });

  revalidatePath("/admin/assets/import");
  revalidatePath("/admin/assets");
  revalidatePath("/app/assets");
  redirect(`/admin/assets/import?ok=done${encoding === "gb18030" ? "&enc=gbk" : ""}`);
}
