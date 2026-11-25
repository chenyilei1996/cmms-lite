import { Bell, Checks, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { canManage, requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { markAllRead, openNotification } from "@/server/notification-actions";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

export const metadata = { title: "通知" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const manageable = canManage(user.role);
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(80);

  const unread = rows.filter((row) => !row.readAt);

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="站内通知"
        description="派工、转派、PM 到期和点检异常会推送到这里。通知失败不阻断业务流转。"
        actions={
          <>
            {manageable && (
              <LinkButton href="/admin/settings/audit" variant="secondary">
                <ShieldCheck className="size-4" /> 审计日志
              </LinkButton>
            )}
            {unread.length > 0 && (
              <form action={markAllRead}>
                <SubmitButton variant="secondary">
                  <Checks className="size-4" /> 全部已读
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="accent">未读 {unread.length}</Badge>
        <Badge tone="neutral">全部 {rows.length}</Badge>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-8" />}
          title="没有通知"
          hint="工单派给你、PM 到期或点检异常时，会在这里提醒。"
        />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-paper/60 ${
                      row.readAt ? "" : "bg-accent-soft/30"
                    }`}
                  >
                    <span
                      className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        row.readAt ? "bg-paper text-muted" : "bg-accent-soft text-accent-ink"
                      }`}
                    >
                      <Bell className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[12px] font-medium">
                          {row.title}
                        </span>
                        {!row.readAt && (
                          <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                        )}
                      </span>
                      {row.body && (
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                          {row.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[10px] text-muted/70">
                        {timeAgo(row.createdAt)}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {manageable && (
        <p className="mt-4 text-[11px] text-muted">
          需要查看全部操作留痕？进入{" "}
          <Link href="/admin/settings/audit" className="text-accent-ink underline underline-offset-4">
            审计日志
          </Link>
          。
        </p>
      )}
    </>
  );
}
