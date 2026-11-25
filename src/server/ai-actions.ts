"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { isAdmin, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  AI_DEFAULT_BASE_URL,
  AI_TRIGGER_MODES,
  type AiTriggerMode,
} from "@/lib/ai";
import { AI_CONFIG_ID } from "@/lib/ai-config";
import { encryptSecret } from "@/lib/crypto";

export async function saveAiConfig(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/admin/settings?error=forbidden");

  const baseUrlRaw = String(formData.get("baseUrl") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const triggerRaw = String(formData.get("triggerMode") ?? "manual");
  const triggerMode: AiTriggerMode = AI_TRIGGER_MODES.includes(
    triggerRaw as AiTriggerMode,
  )
    ? (triggerRaw as AiTriggerMode)
    : "manual";
  const enabled = formData.get("enabled") === "on";
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const clearKey = formData.get("clearKey") === "on";

  let baseUrl = baseUrlRaw || AI_DEFAULT_BASE_URL;
  try {
    baseUrl = new URL(baseUrl).toString().replace(/\/+$/, "");
  } catch {
    redirect("/admin/settings/ai?error=url");
  }
  if (!/^https?:\/\//.test(baseUrl)) {
    redirect("/admin/settings/ai?error=url");
  }
  if (!model) redirect("/admin/settings/ai?error=model");

  const [existing] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, AI_CONFIG_ID))
    .limit(1);

  // 留空表示沿用旧密钥；勾选清除则强制置空
  const nextKey = clearKey
    ? null
    : apiKey
      ? encryptSecret(apiKey)
      : existing?.apiKey ?? null;

  if (enabled && !nextKey) {
    redirect("/admin/settings/ai?error=key");
  }

  const values = {
    id: AI_CONFIG_ID,
    enabled,
    baseUrl,
    model,
    apiKey: nextKey,
    triggerMode,
    updatedAt: new Date(),
    updatedById: user.id,
  };

  if (existing) {
    await db
      .update(aiSettings)
      .set(values)
      .where(eq(aiSettings.id, AI_CONFIG_ID));
  } else {
    await db.insert(aiSettings).values(values);
  }

  await audit({
    entityType: "ai_config",
    action: "ai.config.update",
    detail: {
      enabled,
      baseUrl,
      model,
      triggerMode,
      keyChanged: Boolean(apiKey) || clearKey,
    },
    actorId: user.id,
    actorName: user.name,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/ai");
  revalidatePath("/app/faults");
  redirect("/admin/settings/ai?ok=1");
}
