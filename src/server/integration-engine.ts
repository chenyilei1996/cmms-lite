import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  assetStatusHistory,
  assets,
  downtimeRecords,
  integrationEndpoints,
  integrationMockMessages,
  inventoryTransactions,
  spareParts,
  syncJobs,
  syncRecords,
  syncRuns,
  users,
  workOrders,
} from "@/db/schema";
import { audit, notify } from "@/lib/audit";
import { ASSET_STATUS } from "@/lib/constants";
import type {
  SyncDataset,
  SyncRecordStatus,
  SyncRunStatus,
} from "@/lib/integration";

type Actor = { id: string; name: string } | null;
type Endpoint = typeof integrationEndpoints.$inferSelect;
type Job = typeof syncJobs.$inferSelect;

type Counters = {
  total: number;
  applied: number;
  skipped: number;
  conflict: number;
  failed: number;
};

type Outcome = {
  status: SyncRecordStatus;
  message?: string;
  localEntity?: string;
  localCode?: string;
};

type PushItem = {
  externalNo: string;
  key: string;
  payload: Record<string, unknown>;
  localEntity: string;
  localCode: string;
};

const emptyCounters = (): Counters => ({
  total: 0,
  applied: 0,
  skipped: 0,
  conflict: 0,
  failed: 0,
});

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function authHeaders(endpoint: Endpoint): Record<string, string> {
  if (endpoint.authType === "token" && endpoint.token) {
    return { authorization: `Bearer ${endpoint.token}` };
  }
  if (endpoint.authType === "basic" && endpoint.token) {
    return { authorization: `Basic ${endpoint.token}` };
  }
  return {};
}

async function nextAttempt(key: string) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${syncRecords.attemptNo}), 0)` })
    .from(syncRecords)
    .where(eq(syncRecords.idempotencyKey, key));
  return Number(row?.max ?? 0) + 1;
}

/** 幂等判定：同一业务键已成功写入过，就只记跳过，不重复落库/推送。 */
async function alreadyApplied(key: string) {
  const [row] = await db
    .select({ id: syncRecords.id })
    .from(syncRecords)
    .where(
      and(
        eq(syncRecords.idempotencyKey, key),
        inArray(syncRecords.status, ["created", "updated"]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function recordOutcome(input: {
  runId: string;
  jobId: string;
  key: string;
  externalNo: string;
  payload: Record<string, unknown>;
  outcome: Outcome;
}) {
  const attemptNo = await nextAttempt(input.key);
  await db.insert(syncRecords).values({
    runId: input.runId,
    jobId: input.jobId,
    idempotencyKey: input.key,
    attemptNo,
    externalNo: input.externalNo,
    localEntity: input.outcome.localEntity ?? null,
    localCode: input.outcome.localCode ?? null,
    status: input.outcome.status,
    message: input.outcome.message ?? null,
    payload: input.payload,
  });
}

function countOutcome(counters: Counters, status: SyncRecordStatus) {
  if (status === "skipped") counters.skipped += 1;
  else if (status === "conflict") counters.conflict += 1;
  else if (status === "failed") counters.failed += 1;
  else counters.applied += 1;
}

async function deliverPush(
  endpoint: Endpoint,
  dataset: SyncDataset,
  item: PushItem,
): Promise<Outcome> {
  if (endpoint.mock) {
    await db.insert(integrationMockMessages).values({
      endpointId: endpoint.id,
      dataset,
      externalNo: item.externalNo,
      payload: item.payload,
      status: "received",
      note: "推送任务写入 Mock 对端",
    });
    return {
      status: "created",
      message: "已写入 Mock 对端",
      localEntity: item.localEntity,
      localCode: item.localCode,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `${endpoint.baseUrl.replace(/\/+$/, "")}/sync/${dataset}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...authHeaders(endpoint),
        },
        body: JSON.stringify({
          externalNo: item.externalNo,
          payload: item.payload,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return {
        status: "failed",
        message: `对端返回 HTTP ${response.status}`,
        localEntity: item.localEntity,
        localCode: item.localCode,
      };
    }
    return {
      status: "created",
      message: "对端已接收",
      localEntity: item.localEntity,
      localCode: item.localCode,
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "请求对端失败",
      localEntity: item.localEntity,
      localCode: item.localCode,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function collectPushItems(
  dataset: SyncDataset,
  endpoint: Endpoint,
): Promise<PushItem[]> {
  if (dataset === "asset_master") {
    const rows = await db
      .select()
      .from(assets)
      .where(inArray(assets.level, ["machine", "component"]))
      .orderBy(asc(assets.code));
    return rows.map((asset) => ({
      externalNo: asset.code,
      key: `push:asset_master:${endpoint.code}:${asset.code}:${iso(asset.updatedAt)}`,
      localEntity: "asset",
      localCode: asset.code,
      payload: {
        code: asset.code,
        name: asset.name,
        category: asset.category,
        level: asset.level,
        status: asset.status,
        criticality: asset.criticality,
        manufacturer: asset.manufacturer,
        vendor: asset.vendor,
        model: asset.model,
        serialNo: asset.serialNo,
        installLocation: asset.installLocation,
        responsibleName: asset.responsibleName,
        locationId: asset.locationId,
      },
    }));
  }

  if (dataset === "work_order") {
    const rows = await db
      .select({ order: workOrders, assetCode: assets.code })
      .from(workOrders)
      .innerJoin(assets, eq(workOrders.assetId, assets.id))
      .where(inArray(workOrders.status, ["completed", "closed"]))
      .orderBy(desc(workOrders.updatedAt))
      .limit(100);
    return rows.map(({ order, assetCode }) => ({
      externalNo: order.code,
      key: `push:work_order:${endpoint.code}:${order.code}:${iso(order.updatedAt)}`,
      localEntity: "work_order",
      localCode: order.code,
      payload: {
        code: order.code,
        assetCode,
        type: order.type,
        title: order.title,
        description: order.description,
        status: order.status,
        priority: order.priority,
        resolution: order.resolution,
        downtimeMinutes: order.downtimeMinutes,
        laborMinutes: order.laborMinutes,
        completedAt: iso(order.completedAt),
        closedAt: iso(order.closedAt),
      },
    }));
  }

  if (dataset === "material_issue") {
    const rows = await db
      .select({
        txn: inventoryTransactions,
        partCode: spareParts.code,
        partName: spareParts.name,
      })
      .from(inventoryTransactions)
      .innerJoin(spareParts, eq(inventoryTransactions.partId, spareParts.id))
      .where(eq(inventoryTransactions.type, "out"))
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(100);
    return rows.map(({ txn, partCode, partName }) => ({
      externalNo: `TXN-${txn.id.slice(0, 8)}`,
      key: `push:material_issue:${endpoint.code}:${txn.id}`,
      localEntity: "inventory_txn",
      localCode: `TXN-${txn.id.slice(0, 8)}`,
      payload: {
        partCode,
        partName,
        quantity: txn.quantity,
        unitCost: txn.unitCost,
        amount: txn.amount,
        workOrderId: txn.workOrderId,
        note: txn.note,
        createdAt: iso(txn.createdAt),
      },
    }));
  }

  const rows = await db
    .select({ record: downtimeRecords, assetCode: assets.code })
    .from(downtimeRecords)
    .innerJoin(assets, eq(downtimeRecords.assetId, assets.id))
    .orderBy(desc(downtimeRecords.startedAt))
    .limit(100);
  return rows.map(({ record, assetCode }) => ({
    externalNo: `DT-${record.id.slice(0, 8)}`,
    key: `push:downtime:${endpoint.code}:${record.id}`,
    localEntity: "downtime",
    localCode: `DT-${record.id.slice(0, 8)}`,
    payload: {
      assetCode,
      type: record.type,
      responsibility: record.responsibility,
      startedAt: iso(record.startedAt),
      endedAt: iso(record.endedAt),
      minutes: record.minutes,
      affectedOutput: record.affectedOutput,
      note: record.note,
    },
  }));
}

async function runPush(job: Job, endpoint: Endpoint, runId: string) {
  const counters = emptyCounters();
  const items = await collectPushItems(job.dataset, endpoint);
  for (const item of items) {
    counters.total += 1;
    if (await alreadyApplied(item.key)) {
      await recordOutcome({
        runId,
        jobId: job.id,
        key: item.key,
        externalNo: item.externalNo,
        payload: item.payload,
        outcome: {
          status: "skipped",
          message: "同一数据版本已同步成功，幂等跳过",
          localEntity: item.localEntity,
          localCode: item.localCode,
        },
      });
      counters.skipped += 1;
      continue;
    }
    const outcome = await deliverPush(endpoint, job.dataset, item);
    await recordOutcome({
      runId,
      jobId: job.id,
      key: item.key,
      externalNo: item.externalNo,
      payload: item.payload,
      outcome,
    });
    countOutcome(counters, outcome.status);
  }
  return counters;
}

async function findAsset(code: string) {
  if (!code) return undefined;
  const [row] = await db
    .select()
    .from(assets)
    .where(eq(assets.code, code))
    .limit(1);
  return row;
}

async function consumeMessage(id: string | undefined, runId: string) {
  if (!id) return;
  await db
    .update(integrationMockMessages)
    .set({ status: "consumed", consumedRunId: runId })
    .where(eq(integrationMockMessages.id, id));
}

async function applyPullWorkOrder(
  payload: Record<string, unknown>,
  externalNo: string,
  endpoint: Endpoint,
): Promise<Outcome> {
  const assetCode = text(payload.assetCode).toUpperCase();
  const asset = await findAsset(assetCode);
  if (!asset) {
    return {
      status: "conflict",
      message: `本地未找到设备编码 ${assetCode || "(空)"}，补齐设备后再重试`,
      localEntity: "work_order",
    };
  }

  const code = externalNo.slice(0, 60);
  const [existing] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(eq(workOrders.code, code))
    .limit(1);
  if (existing) {
    return {
      status: "skipped",
      message: `工单号 ${code} 已存在`,
      localEntity: "work_order",
      localCode: code,
    };
  }

  const type = payload.type === "corrective" ? "corrective" : "fault";
  const priority = ["low", "medium", "high", "urgent"].includes(
    text(payload.priority),
  )
    ? (text(payload.priority) as "low" | "medium" | "high" | "urgent")
    : "medium";
  const title = text(payload.title, `外部报修 ${externalNo}`);
  const description = text(payload.description, `${endpoint.name} 自动同步`);

  const [created] = await db
    .insert(workOrders)
    .values({
      code,
      assetId: asset.id,
      type,
      title,
      description,
      status: "new",
      priority,
    })
    .returning({ id: workOrders.id });

  const managers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, ["admin", "manager"])));
  await Promise.all(
    managers.map((manager) =>
      notify(
        manager.id,
        "已同步外部报修工单",
        `${endpoint.name} 推送 ${code}：${title}`,
        `/app/work-orders/${created.id}`,
      ),
    ),
  );

  return {
    status: "created",
    message: `已创建工单 ${code}`,
    localEntity: "work_order",
    localCode: code,
  };
}

async function applyPullAssetMaster(
  payload: Record<string, unknown>,
  externalNo: string,
  endpoint: Endpoint,
): Promise<Outcome> {
  const code = text(payload.code).toUpperCase();
  const asset = await findAsset(code);
  if (!asset) {
    return {
      status: "conflict",
      message: `本地未找到设备编码 ${code || "(空)"}，无法更新主数据`,
      localEntity: "asset",
      localCode: code || undefined,
    };
  }

  const statusKeys = Object.keys(ASSET_STATUS);
  const nextStatus =
    typeof payload.status === "string" && statusKeys.includes(payload.status)
      ? (payload.status as typeof asset.status)
      : asset.status;
  const nextCriticality = ["A", "B", "C"].includes(text(payload.criticality))
    ? (text(payload.criticality) as typeof asset.criticality)
    : asset.criticality;

  await db
    .update(assets)
    .set({
      name: text(payload.name, asset.name),
      category: text(payload.category, asset.category),
      manufacturer:
        typeof payload.manufacturer === "string"
          ? payload.manufacturer
          : asset.manufacturer,
      vendor: typeof payload.vendor === "string" ? payload.vendor : asset.vendor,
      model: typeof payload.model === "string" ? payload.model : asset.model,
      serialNo:
        typeof payload.serialNo === "string" ? payload.serialNo : asset.serialNo,
      status: nextStatus,
      criticality: nextCriticality,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, asset.id));

  if (nextStatus !== asset.status) {
    await db.insert(assetStatusHistory).values({
      assetId: asset.id,
      fromStatus: asset.status,
      toStatus: nextStatus,
      reason: `${endpoint.name} 主数据同步（${externalNo}）`,
      source: "integration",
    });
  }

  return {
    status: "updated",
    message:
      nextStatus !== asset.status
        ? `设备主数据已更新，状态 ${asset.status} → ${nextStatus}`
        : "设备主数据已更新",
    localEntity: "asset",
    localCode: asset.code,
  };
}

async function applyPullItem(
  dataset: SyncDataset,
  payload: Record<string, unknown>,
  externalNo: string,
  endpoint: Endpoint,
): Promise<Outcome> {
  if (dataset === "work_order") {
    return applyPullWorkOrder(payload, externalNo, endpoint);
  }
  if (dataset === "asset_master") {
    return applyPullAssetMaster(payload, externalNo, endpoint);
  }
  return {
    status: "conflict",
    message: "该数据集暂不支持拉取落库",
    localEntity: dataset,
  };
}

async function runPull(job: Job, endpoint: Endpoint, runId: string) {
  const counters = emptyCounters();
  const messages: Array<{
    id?: string;
    externalNo: string;
    payload: Record<string, unknown>;
  }> = [];

  if (endpoint.mock) {
    const rows = await db
      .select()
      .from(integrationMockMessages)
      .where(
        and(
          eq(integrationMockMessages.endpointId, endpoint.id),
          eq(integrationMockMessages.dataset, job.dataset),
          eq(integrationMockMessages.status, "pending"),
        ),
      )
      .orderBy(asc(integrationMockMessages.createdAt))
      .limit(50);
    for (const row of rows) {
      messages.push({
        id: row.id,
        externalNo: row.externalNo,
        payload: row.payload ?? {},
      });
    }
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `${endpoint.baseUrl.replace(/\/+$/, "")}/sync/${job.dataset}?status=pending`,
        {
          headers: { accept: "application/json", ...authHeaders(endpoint) },
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error(`对端返回 HTTP ${response.status}`);
      const body = (await response.json()) as {
        items?: Array<{ externalNo?: unknown; payload?: unknown }>;
      };
      for (const item of body.items ?? []) {
        const externalNo = text(item.externalNo);
        if (!externalNo) continue;
        messages.push({
          externalNo,
          payload:
            item.payload && typeof item.payload === "object"
              ? (item.payload as Record<string, unknown>)
              : {},
        });
      }
    } finally {
      clearTimeout(timer);
    }
  }

  for (const message of messages) {
    counters.total += 1;
    const key = `pull:${job.dataset}:${endpoint.code}:${message.externalNo}`;
    if (await alreadyApplied(key)) {
      await recordOutcome({
        runId,
        jobId: job.id,
        key,
        externalNo: message.externalNo,
        payload: message.payload,
        outcome: { status: "skipped", message: "该外部单号已处理过，幂等跳过" },
      });
      counters.skipped += 1;
      await consumeMessage(message.id, runId);
      continue;
    }

    let outcome: Outcome;
    try {
      outcome = await applyPullItem(
        job.dataset,
        message.payload,
        message.externalNo,
        endpoint,
      );
    } catch (error) {
      outcome = {
        status: "failed",
        message: error instanceof Error ? error.message : "落库失败",
      };
    }
    await recordOutcome({
      runId,
      jobId: job.id,
      key,
      externalNo: message.externalNo,
      payload: message.payload,
      outcome,
    });
    countOutcome(counters, outcome.status);
    if (outcome.status === "created" || outcome.status === "updated" || outcome.status === "skipped") {
      await consumeMessage(message.id, runId);
    }
  }

  return counters;
}

async function finalizeRun(input: {
  runId: string;
  job: Job;
  counters: Counters;
  message?: string;
  actor: Actor;
}) {
  const { runId, job, counters, actor } = input;
  const problem = counters.conflict + counters.failed;
  const status: SyncRunStatus =
    problem === 0 ? "success" : counters.applied > 0 ? "partial" : "failed";
  const message =
    input.message ??
    (counters.total === 0
      ? "没有需要同步的数据"
      : `共 ${counters.total} 条：成功 ${counters.applied}，跳过 ${counters.skipped}，冲突 ${counters.conflict}，失败 ${counters.failed}`);

  await db
    .update(syncRuns)
    .set({
      status,
      total: counters.total,
      applied: counters.applied,
      skipped: counters.skipped,
      conflict: counters.conflict,
      failed: counters.failed,
      message,
      finishedAt: new Date(),
    })
    .where(eq(syncRuns.id, runId));

  await db
    .update(syncJobs)
    .set({ lastRunAt: new Date(), lastStatus: status, updatedAt: new Date() })
    .where(eq(syncJobs.id, job.id));

  await audit({
    entityType: "integration_run",
    entityId: runId,
    action: "integration.sync",
    detail: {
      job: job.code,
      dataset: job.dataset,
      direction: job.direction,
      status,
      ...counters,
    },
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? null,
  });

  return status;
}

/** 执行一次同步任务，写入 sync_runs / sync_records 并返回运行 ID。 */
export async function executeSyncJob(
  jobId: string,
  actor: Actor,
  trigger = "manual",
) {
  const [job] = await db
    .select()
    .from(syncJobs)
    .where(eq(syncJobs.id, jobId))
    .limit(1);
  if (!job) throw new Error("同步任务不存在");

  const [endpoint] = await db
    .select()
    .from(integrationEndpoints)
    .where(eq(integrationEndpoints.id, job.endpointId))
    .limit(1);
  if (!endpoint) throw new Error("集成端点不存在");

  const [run] = await db
    .insert(syncRuns)
    .values({
      jobId: job.id,
      status: "running",
      dataset: job.dataset,
      direction: job.direction,
      trigger,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
    })
    .returning({ id: syncRuns.id });

  let counters = emptyCounters();
  let message: string | undefined;
  try {
    counters =
      job.direction === "push"
        ? await runPush(job, endpoint, run.id)
        : await runPull(job, endpoint, run.id);
  } catch (error) {
    message = error instanceof Error ? error.message : "同步执行异常";
    counters = { ...counters, failed: Math.max(counters.failed, 1) };
  }

  await finalizeRun({ runId: run.id, job, counters, message, actor });
  return run.id;
}

/** 重试一次运行中失败 / 冲突的记录，新建一条重试运行并保留原始运行。 */
export async function retryFailedRun(runId: string, actor: Actor) {
  const [source] = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.id, runId))
    .limit(1);
  if (!source) throw new Error("运行记录不存在");

  const [job] = await db
    .select()
    .from(syncJobs)
    .where(eq(syncJobs.id, source.jobId))
    .limit(1);
  if (!job) throw new Error("同步任务不存在");
  const [endpoint] = await db
    .select()
    .from(integrationEndpoints)
    .where(eq(integrationEndpoints.id, job.endpointId))
    .limit(1);
  if (!endpoint) throw new Error("集成端点不存在");

  const failedRecords = await db
    .select()
    .from(syncRecords)
    .where(
      and(
        eq(syncRecords.runId, runId),
        inArray(syncRecords.status, ["failed", "conflict"]),
      ),
    )
    .orderBy(asc(syncRecords.createdAt));

  const [retryRun] = await db
    .insert(syncRuns)
    .values({
      jobId: job.id,
      status: "running",
      dataset: job.dataset,
      direction: job.direction,
      trigger: "retry",
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
    })
    .returning({ id: syncRuns.id });

  const counters = emptyCounters();
  for (const record of failedRecords) {
    counters.total += 1;
    const key = record.idempotencyKey;
    const payload = record.payload ?? {};

    if (await alreadyApplied(key)) {
      await recordOutcome({
        runId: retryRun.id,
        jobId: job.id,
        key,
        externalNo: record.externalNo ?? "",
        payload,
        outcome: { status: "skipped", message: "重试前已成功，幂等跳过" },
      });
      counters.skipped += 1;
      continue;
    }

    let outcome: Outcome;
    if (job.direction === "push") {
      outcome = await deliverPush(endpoint, job.dataset, {
        externalNo: record.externalNo ?? record.localCode ?? key,
        key,
        payload,
        localEntity: record.localEntity ?? job.dataset,
        localCode: record.localCode ?? "",
      });
    } else {
      try {
        outcome = await applyPullItem(
          job.dataset,
          payload,
          record.externalNo ?? "",
          endpoint,
        );
      } catch (error) {
        outcome = {
          status: "failed",
          message: error instanceof Error ? error.message : "重试失败",
        };
      }
      if (
        outcome.status === "created" ||
        outcome.status === "updated" ||
        outcome.status === "skipped"
      ) {
        const [message] = await db
          .select({ id: integrationMockMessages.id })
          .from(integrationMockMessages)
          .where(
            and(
              eq(integrationMockMessages.endpointId, endpoint.id),
              eq(integrationMockMessages.externalNo, record.externalNo ?? ""),
              eq(integrationMockMessages.status, "pending"),
            ),
          )
          .limit(1);
        await consumeMessage(message?.id, retryRun.id);
      }
    }

    await recordOutcome({
      runId: retryRun.id,
      jobId: job.id,
      key,
      externalNo: record.externalNo ?? "",
      payload,
      outcome,
    });
    countOutcome(counters, outcome.status);
  }

  await finalizeRun({
    runId: retryRun.id,
    job,
    counters,
    message:
      failedRecords.length === 0
        ? "该运行没有失败或冲突记录"
        : undefined,
    actor,
  });

  return retryRun.id;
}
