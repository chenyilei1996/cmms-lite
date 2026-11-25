import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db";
import { repairRequests, workOrders } from "@/db/schema";
import { WO_STATUS } from "@/lib/constants";
import {
  OPEN_REPAIR_WO_STATUSES,
  type RepairDuplicate,
} from "@/lib/repair";

/**
 * 查找同设备未关闭的维修工单或待受理报修，用于扫码报修去重提示。
 * 只返回可公开展示的字段，不包含报修人信息。
 */
export async function findOpenRepair(
  assetId: string,
): Promise<RepairDuplicate | null> {
  const [workOrder] = await db
    .select({
      code: workOrders.code,
      title: workOrders.title,
      status: workOrders.status,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.assetId, assetId),
        inArray(workOrders.status, [...OPEN_REPAIR_WO_STATUSES]),
      ),
    )
    .orderBy(desc(workOrders.createdAt))
    .limit(1);

  if (workOrder) {
    return {
      kind: "work_order",
      code: workOrder.code,
      title: workOrder.title,
      statusLabel: WO_STATUS[workOrder.status]?.label ?? workOrder.status,
      createdAt: workOrder.createdAt.toISOString(),
    };
  }

  const cutoff = new Date(new Date().getTime() - 30 * 86400000);
  const [request] = await db
    .select({
      description: repairRequests.description,
      createdAt: repairRequests.createdAt,
    })
    .from(repairRequests)
    .where(
      and(
        eq(repairRequests.assetId, assetId),
        eq(repairRequests.status, "submitted"),
        gte(repairRequests.createdAt, cutoff),
      ),
    )
    .orderBy(desc(repairRequests.createdAt))
    .limit(1);

  if (request) {
    return {
      kind: "request",
      code: null,
      title: request.description.slice(0, 60),
      statusLabel: "待受理",
      createdAt: request.createdAt.toISOString(),
    };
  }

  return null;
}
