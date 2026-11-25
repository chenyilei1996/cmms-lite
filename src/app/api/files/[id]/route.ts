import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { attachments, inspectionTasks, repairRequests, workOrders } from "@/db/schema";
import { getActiveUser, canManage } from "@/lib/auth";

const INLINE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

/** 对象级授权：非管理岗只能下载与自己相关的工单 / 点检附件。 */
async function canAccess(entityType: string, entityId: string, userId: string) {
  if (entityType === "work_order") {
    const [row] = await db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.id, entityId),
          or(
            eq(workOrders.assigneeId, userId),
            eq(workOrders.acceptedById, userId),
          ),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  if (entityType === "inspection_task") {
    const [row] = await db
      .select({ id: inspectionTasks.id })
      .from(inspectionTasks)
      .where(
        and(eq(inspectionTasks.id, entityId), eq(inspectionTasks.assigneeId, userId)),
      )
      .limit(1);
    return Boolean(row);
  }
  if (entityType === "repair_request") {
    const [row] = await db
      .select({ workOrderId: repairRequests.workOrderId })
      .from(repairRequests)
      .where(eq(repairRequests.id, entityId))
      .limit(1);
    if (!row?.workOrderId) return false;
    return canAccess("work_order", row.workOrderId, userId);
  }
  // 设备手册、备件图片等组织内只读附件，登录即可访问
  return true;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveUser();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const [file] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  if (!canManage(session.role)) {
    const allowed = await canAccess(file.entityType, file.entityId, session.id);
    if (!allowed) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const base = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.UPLOAD_DIR ?? "./data/uploads",
  );
  const relative = file.filePath.replace(/^uploads\//, "");
  const fullPath = path.resolve(base, relative);

  if (!fullPath.startsWith(base)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const buffer = await readFile(fullPath);
    const inline = INLINE_MIME.has(file.mime.toLowerCase());
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": inline ? file.mime : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(
          file.fileName,
        )}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
