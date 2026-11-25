import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { attachments } from "@/db/schema";

export const MAX_FILE_SIZE = 8 * 1024 * 1024;
export const MAX_FILES = 3;
export const MAX_DOC_SIZE = 20 * 1024 * 1024;

const extByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const docExtByMime: Record<string, string> = {
  ...extByMime,
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "application/zip": "zip",
};

export function pickUploads(
  formData: FormData,
  field = "photos",
  limit = MAX_FILES,
): File[] {
  return formData
    .getAll(field)
    .filter((item): item is File => item instanceof File && item.size > 0)
    .slice(0, limit);
}

/**
 * 保存上传图片并写入附件表，返回成功保存的数量。
 * 单张超过 8MB 或写入失败的文件会被跳过，不影响其他文件。
 */
export async function saveUploads(
  files: File[],
  entityType: string,
  entityId: string,
  limit = MAX_FILES,
): Promise<number> {
  const picked = files.filter((file) => file.size > 0).slice(0, limit);
  if (!picked.length) return 0;

  const uploadDir = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.UPLOAD_DIR ?? "./data/uploads",
  );
  await mkdir(uploadDir, { recursive: true });

  let saved = 0;
  for (const file of picked) {
    if (file.size > MAX_FILE_SIZE) continue;
    const ext = extByMime[file.type] ?? "jpg";
    const fileName = `${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(
      path.join(/* turbopackIgnore: true */ uploadDir, fileName),
      buffer,
    );
    await db.insert(attachments).values({
      entityType,
      entityId,
      filePath: `uploads/${fileName}`,
      fileName: file.name,
      mime: file.type || "image/jpeg",
      size: file.size,
    });
    saved += 1;
  }
  return saved;
}

/**
 * 保存一机一档文档（PDF/Office/图片等），返回已写入的附件记录。
 * 不支持的类型或超大文件会被跳过。
 */
export async function saveDocumentUploads(
  files: File[],
  entityType: string,
  entityId: string,
  limit = 5,
): Promise<{ id: string; fileName: string }[]> {
  const picked = files
    .filter((file) => file.size > 0 && file.size <= MAX_DOC_SIZE)
    .slice(0, limit);
  if (!picked.length) return [];

  const uploadDir = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.UPLOAD_DIR ?? "./data/uploads",
  );
  await mkdir(uploadDir, { recursive: true });

  const saved: { id: string; fileName: string }[] = [];
  for (const file of picked) {
    const ext = docExtByMime[file.type];
    if (!ext) continue;
    const fileName = `${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(
      path.join(/* turbopackIgnore: true */ uploadDir, fileName),
      buffer,
    );
    const [row] = await db
      .insert(attachments)
      .values({
        entityType,
        entityId,
        filePath: `uploads/${fileName}`,
        fileName: file.name,
        mime: file.type,
        size: file.size,
      })
      .returning({ id: attachments.id });
    saved.push({ id: row.id, fileName: file.name });
  }
  return saved;
}
