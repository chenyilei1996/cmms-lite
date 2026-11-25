import { db } from "@/db";
import { auditLogs, notifications } from "@/db/schema";

type AuditInput = {
  entityType: string;
  entityId?: string | null;
  action: string;
  detail?: Record<string, unknown>;
  actorId?: string | null;
  actorName?: string | null;
  /** 来源 IP / 系统标识，写入 detail.sourceIp，便于追溯开放接口调用方。 */
  ip?: string | null;
};

/**
 * 关键操作审计：状态、权限、签名、文档、导出等不可编辑留痕。
 * 审计写入失败不应影响主业务，内部兜底记录日志。
 */
export async function audit(entry: AuditInput) {
  try {
    const detail = entry.ip
      ? { ...(entry.detail ?? {}), sourceIp: entry.ip }
      : entry.detail;
    await db.insert(auditLogs).values({
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      action: entry.action,
      detail,
      actorId: entry.actorId ?? null,
      actorName: entry.actorName ?? null,
    });
  } catch (error) {
    console.error("audit write failed", entry.action, error);
  }
}

/** 站内通知：写入失败不应阻断业务。 */
export async function notify(
  userId: string | null | undefined,
  title: string,
  body?: string | null,
  link?: string | null,
) {
  if (!userId) return;
  try {
    await db.insert(notifications).values({
      userId,
      title,
      body: body ?? null,
      link: link ?? null,
    });
  } catch (error) {
    console.error("notify write failed", title, error);
  }
}
