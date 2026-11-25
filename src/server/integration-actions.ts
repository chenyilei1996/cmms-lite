"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  integrationEndpoints,
  integrationMockMessages,
  syncJobs,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { canManage, requireUser } from "@/lib/auth";
import { ASSET_STATUS } from "@/lib/constants";
import {
  datasetsFor,
  isIntegrationSystem,
  isSyncDataset,
  isSyncDirection,
  type SyncDataset,
} from "@/lib/integration";
import { executeSyncJob, retryFailedRun } from "./integration-engine";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function revalidateIntegration() {
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/integrations/endpoints");
  revalidatePath("/admin/integrations/mock");
  revalidatePath("/admin/integrations/runs");
  revalidatePath("/admin/integrations/reconcile");
}

export async function createEndpoint(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/admin/integrations?error=forbidden");

  const code = text(formData, "code")?.toUpperCase() ?? null;
  const name = text(formData, "name");
  const baseUrl = text(formData, "baseUrl");
  const systemRaw = String(formData.get("system") ?? "");
  if (!code || !name || !baseUrl || !isIntegrationSystem(systemRaw)) {
    redirect("/admin/integrations/endpoints?error=fields");
  }

  const [duplicate] = await db
    .select({ id: integrationEndpoints.id })
    .from(integrationEndpoints)
    .where(eq(integrationEndpoints.code, code))
    .limit(1);
  if (duplicate) redirect("/admin/integrations/endpoints?error=duplicate");

  const [created] = await db
    .insert(integrationEndpoints)
    .values({
      code,
      name,
      system: systemRaw,
      baseUrl: baseUrl.replace(/\/+$/, ""),
      authType: String(formData.get("authType") ?? "token"),
      token: text(formData, "token"),
      mock: formData.get("mock") === "1",
      enabled: formData.get("enabled") !== "0",
      note: text(formData, "note"),
    })
    .returning({ id: integrationEndpoints.id });

  await audit({
    entityType: "integration_endpoint",
    entityId: created.id,
    action: "integration.endpoint.create",
    detail: { code, name, system: systemRaw },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateIntegration();
  redirect("/admin/integrations/endpoints?ok=created");
}

export async function toggleEndpoint(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/admin/integrations?error=forbidden");

  const id = String(formData.get("id") ?? "");
  const enabled = String(formData.get("enabled") ?? "1") === "1";
  if (!id) redirect("/admin/integrations/endpoints");

  const [row] = await db
    .select({ code: integrationEndpoints.code })
    .from(integrationEndpoints)
    .where(eq(integrationEndpoints.id, id))
    .limit(1);
  if (!row) redirect("/admin/integrations/endpoints?error=missing");

  await db
    .update(integrationEndpoints)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(integrationEndpoints.id, id));

  await audit({
    entityType: "integration_endpoint",
    entityId: id,
    action: enabled ? "integration.endpoint.enable" : "integration.endpoint.disable",
    detail: { code: row.code },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateIntegration();
  redirect("/admin/integrations/endpoints?ok=toggled");
}

export async function createSyncJob(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/admin/integrations?error=forbidden");

  const code = text(formData, "code")?.toUpperCase() ?? null;
  const name = text(formData, "name");
  const endpointId = String(formData.get("endpointId") ?? "");
  const datasetRaw = String(formData.get("dataset") ?? "");
  const directionRaw = String(formData.get("direction") ?? "");

  if (
    !code ||
    !name ||
    !endpointId ||
    !isSyncDataset(datasetRaw) ||
    !isSyncDirection(directionRaw)
  ) {
    redirect("/admin/integrations?error=job-fields");
  }
  if (!datasetsFor(directionRaw).includes(datasetRaw)) {
    redirect("/admin/integrations?error=job-dataset");
  }

  const [endpoint] = await db
    .select({ id: integrationEndpoints.id })
    .from(integrationEndpoints)
    .where(eq(integrationEndpoints.id, endpointId))
    .limit(1);
  if (!endpoint) redirect("/admin/integrations?error=job-endpoint");

  const [duplicate] = await db
    .select({ id: syncJobs.id })
    .from(syncJobs)
    .where(eq(syncJobs.code, code))
    .limit(1);
  if (duplicate) redirect("/admin/integrations?error=job-duplicate");

  const interval = Number(formData.get("intervalMinutes") ?? 30);

  const [created] = await db
    .insert(syncJobs)
    .values({
      code,
      name,
      endpointId,
      dataset: datasetRaw,
      direction: directionRaw,
      intervalMinutes: Number.isFinite(interval) ? Math.max(5, interval) : 30,
      enabled: formData.get("enabled") !== "0",
      note: text(formData, "note"),
    })
    .returning({ id: syncJobs.id });

  await audit({
    entityType: "sync_job",
    entityId: created.id,
    action: "integration.job.create",
    detail: { code, name, dataset: datasetRaw, direction: directionRaw },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateIntegration();
  redirect("/admin/integrations?ok=job-created");
}

export async function toggleSyncJob(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/admin/integrations?error=forbidden");

  const id = String(formData.get("id") ?? "");
  const enabled = String(formData.get("enabled") ?? "1") === "1";
  if (!id) redirect("/admin/integrations");

  const [row] = await db
    .select({ code: syncJobs.code })
    .from(syncJobs)
    .where(eq(syncJobs.id, id))
    .limit(1);
  if (!row) redirect("/admin/integrations?error=job-missing");

  await db
    .update(syncJobs)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(syncJobs.id, id));

  await audit({
    entityType: "sync_job",
    entityId: id,
    action: enabled ? "integration.job.enable" : "integration.job.disable",
    detail: { code: row.code },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateIntegration();
  redirect("/admin/integrations?ok=job-toggled");
}

export async function runSyncJob(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/admin/integrations?error=forbidden");

  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) redirect("/admin/integrations");

  const [job] = await db
    .select({ id: syncJobs.id, enabled: syncJobs.enabled })
    .from(syncJobs)
    .where(eq(syncJobs.id, jobId))
    .limit(1);
  if (!job || !job.enabled) redirect("/admin/integrations?error=job-disabled");

  const runId = await executeSyncJob(jobId, { id: user.id, name: user.name });
  revalidateIntegration();
  redirect(`/admin/integrations/runs/${runId}`);
}

export async function retrySyncRun(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/admin/integrations?error=forbidden");

  const runId = String(formData.get("runId") ?? "");
  if (!runId) redirect("/admin/integrations/runs");

  const retryRunId = await retryFailedRun(runId, {
    id: user.id,
    name: user.name,
  });
  revalidateIntegration();
  redirect(`/admin/integrations/runs/${retryRunId}`);
}

export async function injectMockMessage(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/admin/integrations?error=forbidden");

  const endpointId = String(formData.get("endpointId") ?? "");
  const datasetRaw = String(formData.get("dataset") ?? "");
  if (
    !endpointId ||
    !isSyncDataset(datasetRaw) ||
    !datasetsFor("pull").includes(datasetRaw)
  ) {
    redirect("/admin/integrations/mock?error=fields");
  }

  const [endpoint] = await db
    .select({ id: integrationEndpoints.id, code: integrationEndpoints.code })
    .from(integrationEndpoints)
    .where(eq(integrationEndpoints.id, endpointId))
    .limit(1);
  if (!endpoint) redirect("/admin/integrations/mock?error=endpoint");

  const externalNo = text(formData, "externalNo");
  if (!externalNo) redirect("/admin/integrations/mock?error=external");

  let payload: Record<string, unknown>;
  if (datasetRaw === "work_order") {
    const assetCode = text(formData, "assetCode")?.toUpperCase() ?? null;
    if (!assetCode) redirect("/admin/integrations/mock?error=fields");
    payload = {
      assetCode,
      title: text(formData, "title") ?? `模拟外部报修 ${externalNo}`,
      description: text(formData, "description"),
      priority: String(formData.get("priority") ?? "medium"),
      type: "fault",
      source: "mock",
    };
  } else {
    const code = text(formData, "assetCode")?.toUpperCase() ?? null;
    if (!code) redirect("/admin/integrations/mock?error=fields");
    const statusRaw = String(formData.get("status") ?? "");
    payload = {
      code,
      name: text(formData, "title"),
      category: text(formData, "category"),
      manufacturer: text(formData, "manufacturer"),
      status: statusRaw in ASSET_STATUS ? statusRaw : undefined,
      criticality: ["A", "B", "C"].includes(
        String(formData.get("criticality") ?? ""),
      )
        ? String(formData.get("criticality"))
        : undefined,
      source: "mock",
    };
  }

  const [created] = await db
    .insert(integrationMockMessages)
    .values({
      endpointId,
      dataset: datasetRaw as SyncDataset,
      externalNo,
      payload,
      status: "pending",
      note: text(formData, "note"),
    })
    .returning({ id: integrationMockMessages.id });

  await audit({
    entityType: "integration_mock_message",
    entityId: created.id,
    action: "integration.mock.inject",
    detail: { endpoint: endpoint.code, dataset: datasetRaw, externalNo },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateIntegration();
  redirect("/admin/integrations/mock?ok=injected");
}
