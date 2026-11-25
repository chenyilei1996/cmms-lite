import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import {
  AI_DEFAULT_BASE_URL,
  AI_DEFAULT_MODEL,
  AI_TRIGGER_MODES,
  type AiTriggerMode,
} from "./ai";
import { decryptSecret } from "./crypto";

export const AI_CONFIG_ID = "default";

export type AiConfig = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  triggerMode: AiTriggerMode;
  hasKey: boolean;
  updatedAt: Date | null;
};

function normalizeTrigger(value: string | null | undefined): AiTriggerMode {
  return AI_TRIGGER_MODES.includes(value as AiTriggerMode)
    ? (value as AiTriggerMode)
    : "manual";
}

/** 读取后台配置；表或行不存在时返回默认值（未启用）。 */
export async function getAiConfig(): Promise<AiConfig> {
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, AI_CONFIG_ID))
    .limit(1);

  return {
    enabled: row?.enabled ?? false,
    baseUrl: row?.baseUrl?.trim() || AI_DEFAULT_BASE_URL,
    model: row?.model?.trim() || AI_DEFAULT_MODEL,
    triggerMode: normalizeTrigger(row?.triggerMode),
    hasKey: Boolean(decryptSecret(row?.apiKey)),
    updatedAt: row?.updatedAt ?? null,
  };
}

/** 已启用且密钥可解密时返回运行时配置，否则返回 null。 */
export async function getAiRuntime(): Promise<{
  config: AiConfig;
  apiKey: string;
} | null> {
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, AI_CONFIG_ID))
    .limit(1);
  if (!row || !row.enabled) return null;
  const apiKey = decryptSecret(row.apiKey);
  if (!apiKey) return null;

  return {
    config: {
      enabled: true,
      baseUrl: row.baseUrl?.trim() || AI_DEFAULT_BASE_URL,
      model: row.model?.trim() || AI_DEFAULT_MODEL,
      triggerMode: normalizeTrigger(row.triggerMode),
      hasKey: true,
      updatedAt: row.updatedAt,
    },
    apiKey,
  };
}
