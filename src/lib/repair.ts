export const OPEN_REPAIR_WO_STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "pending_acceptance",
] as const;

export type RepairDuplicate = {
  kind: "work_order" | "request";
  code: string | null;
  title: string;
  statusLabel: string;
  /** ISO 字符串，便于从服务端组件传给客户端组件 */
  createdAt: string;
};

export const RECENT_REPORTS_KEY = "cmms_recent_reports";

export type RecentReport = {
  assetToken: string;
  publicToken: string;
  description: string;
  at: number;
};
