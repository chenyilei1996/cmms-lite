import type { Tone } from "./constants";

export type IntegrationSystem = "mes" | "erp" | "wms" | "iot";
export type SyncDirection = "push" | "pull";
export type SyncDataset =
  | "asset_master"
  | "work_order"
  | "material_issue"
  | "downtime";
export type SyncRunStatus = "running" | "success" | "partial" | "failed";
export type SyncRecordStatus =
  | "created"
  | "updated"
  | "skipped"
  | "conflict"
  | "failed";
export type MockMessageStatus = "pending" | "consumed" | "received";

export const INTEGRATION_SYSTEM: Record<
  IntegrationSystem,
  { label: string; short: string; tone: Tone }
> = {
  mes: { label: "MES 制造执行", short: "MES", tone: "accent" },
  erp: { label: "ERP 企业资源", short: "ERP", tone: "mint" },
  wms: { label: "WMS 仓储管理", short: "WMS", tone: "honey" },
  iot: { label: "IoT 设备网关", short: "IoT", tone: "neutral" },
};

export const SYNC_DATASET: Record<
  SyncDataset,
  { label: string; entity: string; hint: string }
> = {
  asset_master: {
    label: "设备主数据",
    entity: "设备档案",
    hint: "设备编码、名称、状态、厂商等主档字段",
  },
  work_order: {
    label: "维修工单",
    entity: "工单",
    hint: "外部报修或完工回传的工单数据",
  },
  material_issue: {
    label: "备件领用",
    entity: "库存流水",
    hint: "工单领用产生的出库流水",
  },
  downtime: {
    label: "停机记录",
    entity: "停机记录",
    hint: "非计划 / 计划停机时长与原因",
  },
};

export const SYNC_DIRECTION: Record<
  SyncDirection,
  { label: string; hint: string; tone: Tone }
> = {
  push: { label: "推送", hint: "本地 → 外部", tone: "accent" },
  pull: { label: "拉取", hint: "外部 → 本地", tone: "mint" },
};

export const SYNC_RUN_STATUS: Record<
  SyncRunStatus,
  { label: string; tone: Tone }
> = {
  running: { label: "同步中", tone: "honey" },
  success: { label: "成功", tone: "mint" },
  partial: { label: "部分成功", tone: "honey" },
  failed: { label: "失败", tone: "danger" },
};

export const SYNC_RECORD_STATUS: Record<
  SyncRecordStatus,
  { label: string; tone: Tone }
> = {
  created: { label: "已创建", tone: "mint" },
  updated: { label: "已更新", tone: "accent" },
  skipped: { label: "幂等跳过", tone: "neutral" },
  conflict: { label: "对账冲突", tone: "honey" },
  failed: { label: "失败", tone: "danger" },
};

export const MOCK_MESSAGE_STATUS: Record<
  MockMessageStatus,
  { label: string; tone: Tone; hint: string }
> = {
  pending: {
    label: "待拉取",
    tone: "honey",
    hint: "外部系统已就绪，等待本地任务拉取",
  },
  consumed: {
    label: "已消费",
    tone: "neutral",
    hint: "已被拉取任务处理",
  },
  received: {
    label: "已接收",
    tone: "mint",
    hint: "本地推送任务写入 Mock 对端",
  },
};

/** 推送方向支持的数据集（本地 → 外部）。 */
export const PUSH_DATASETS: SyncDataset[] = [
  "asset_master",
  "work_order",
  "material_issue",
  "downtime",
];

/** 拉取方向支持的数据集（外部 → 本地），会真实落库。 */
export const PULL_DATASETS: SyncDataset[] = ["work_order", "asset_master"];

export function isIntegrationSystem(value: string): value is IntegrationSystem {
  return value in INTEGRATION_SYSTEM;
}

export function isSyncDataset(value: string): value is SyncDataset {
  return value in SYNC_DATASET;
}

export function isSyncDirection(value: string): value is SyncDirection {
  return value in SYNC_DIRECTION;
}

export function datasetsFor(direction: SyncDirection) {
  return direction === "push" ? PUSH_DATASETS : PULL_DATASETS;
}
