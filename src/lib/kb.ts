import type { Tone } from "./constants";

export type KbCategory =
  | "fault_case"
  | "repair_plan"
  | "operation"
  | "safety"
  | "part_alternative";

export type KbStatus = "draft" | "published" | "archived";

export const KB_CATEGORIES: Record<
  KbCategory,
  { label: string; tone: Tone; hint: string }
> = {
  fault_case: {
    label: "故障案例",
    tone: "danger",
    hint: "真实故障的现象、原因与处理结果",
  },
  repair_plan: {
    label: "维修方案",
    tone: "accent",
    hint: "可复用的拆装、调试与验收步骤",
  },
  operation: {
    label: "操作规程",
    tone: "mint",
    hint: "开停机、换模、点检的标准动作",
  },
  safety: {
    label: "安全提示",
    tone: "honey",
    hint: "上锁挂牌、防护与应急处理要求",
  },
  part_alternative: {
    label: "备件替代",
    tone: "neutral",
    hint: "替代型号、库存对应与代用限制",
  },
};

export const KB_CATEGORY_KEYS = Object.keys(KB_CATEGORIES) as KbCategory[];

export const KB_STATUS: Record<KbStatus, { label: string; tone: Tone }> = {
  draft: { label: "草稿", tone: "neutral" },
  published: { label: "已发布", tone: "mint" },
  archived: { label: "已归档", tone: "ink" },
};

export function isKbCategory(value: string): value is KbCategory {
  return Object.prototype.hasOwnProperty.call(KB_CATEGORIES, value);
}

/** 标签统一存为逗号分隔字符串，读取时去空、去重。 */
export function parseTags(value: string | null | undefined) {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[,，;；]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeTags(value: FormDataEntryValue | null) {
  return parseTags(String(value ?? "")).slice(0, 8).join(",");
}

export function helpfulRate(helpful: number, unhelpful: number) {
  const total = helpful + unhelpful;
  if (!total) return 0;
  return Math.round((helpful / total) * 100);
}
