import { NextResponse, type NextRequest } from "next/server";
import { and, asc, count, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  downtimeRecords,
  faultCodes,
  inspectionRuns,
  inspectionRoutes,
  inspectionTasks,
  inventoryTransactions,
  maintenancePlans,
  spareParts,
  users,
  workOrderParts,
  workOrders,
} from "@/db/schema";
import { canManage, getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  DOWNTIME_TYPE,
  PLAN_TYPE,
  PRIORITY,
  RESPONSIBILITY,
  RUN_STATUS,
  TASK_STATUS,
  TXN_TYPE,
  WO_STATUS,
  WO_TYPE,
} from "@/lib/constants";
import {
  csvFileName,
  fmtHours,
  fmtMinutes,
  fmtPercent,
  LABOR_RATE_PER_HOUR,
  resolveDays,
  toCsv,
} from "@/lib/reporting";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stamp(value: Date | null) {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate(),
  )} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function money(value: number | string | null) {
  if (value === null) return "";
  return Number(value).toFixed(2);
}

function param(value: string | null) {
  return value && value !== "" ? value : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "当前角色无导出权限" }, { status: 403 });
  }

  const { report } = await params;
  const sp = request.nextUrl.searchParams;
  const days = resolveDays(param(sp.get("days")));
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);

  const assetFilter = UUID.test(sp.get("asset") ?? "") ? sp.get("asset")! : undefined;
  const codeFilter = UUID.test(sp.get("code") ?? "") ? sp.get("code")! : undefined;
  const routeFilter = UUID.test(sp.get("route") ?? "") ? sp.get("route")! : undefined;
  const assigneeFilter = UUID.test(sp.get("assignee") ?? "")
    ? sp.get("assignee")!
    : undefined;
  const typeFilter = Object.keys(WO_TYPE).includes(sp.get("type") ?? "")
    ? sp.get("type")!
    : undefined;
  const planTypeFilter = Object.keys(PLAN_TYPE).includes(sp.get("type") ?? "")
    ? sp.get("type")!
    : undefined;
  const priorityFilter = Object.keys(PRIORITY).includes(sp.get("priority") ?? "")
    ? sp.get("priority")!
    : undefined;
  const categoryFilter = param(sp.get("category"));
  const reportKey = report;

  let headers: string[] = [];
  let rows: (string | number | null)[][] = [];

  if (report === "overview") {
    const [woRows, downtimeRows, taskRows, runRows, partRows, machineRows, costRows] =
      await Promise.all([
        db.select().from(workOrders),
        db.select().from(downtimeRecords).where(gte(downtimeRecords.startedAt, since)),
        db
          .select({
            id: inspectionTasks.id,
            status: inspectionTasks.status,
            dueAt: inspectionTasks.dueAt,
            completedAt: inspectionTasks.completedAt,
          })
          .from(inspectionTasks)
          .where(gte(inspectionTasks.dueAt, since)),
        db
          .select({
            id: inspectionRuns.id,
            status: inspectionRuns.status,
            dueAt: inspectionRuns.dueAt,
          })
          .from(inspectionRuns)
          .where(gte(inspectionRuns.dueAt, since)),
        db
          .select({
            stockQty: spareParts.stockQty,
            safetyStock: spareParts.safetyStock,
            referencePrice: spareParts.referencePrice,
            active: spareParts.active,
          })
          .from(spareParts),
        db
          .select({ n: count() })
          .from(assets)
          .where(
            and(
              inArray(assets.level, ["machine", "component"]),
              ne(assets.status, "retired"),
            ),
          ),
        db
          .select({
            workOrderId: workOrderParts.workOrderId,
            quantity: workOrderParts.quantity,
            unitPrice: workOrderParts.unitPrice,
            amount: workOrderParts.amount,
          })
          .from(workOrderParts),
      ]);

    const closed = woRows.filter(
      (wo) =>
        (wo.status === "completed" || wo.status === "closed") &&
        (wo.closedAt ?? wo.completedAt ?? wo.createdAt) >= since,
    );
    const timely = closed.filter(
      (wo) => wo.dueAt && (wo.closedAt ?? wo.completedAt)! <= wo.dueAt,
    );
    const unplanned = downtimeRows.filter((row) => row.type === "unplanned");
    const unplannedMinutes = unplanned.reduce((sum, row) => sum + row.minutes, 0);
    const totalMinutes = downtimeRows.reduce((sum, row) => sum + row.minutes, 0);
    const machineCount = Math.max(1, Number(machineRows[0]?.n ?? 1));
    const available = days * 24 * 60 * machineCount;
    const dueTasks = taskRows.filter((task) => task.dueAt <= now);
    const doneTasks = dueTasks.filter((task) => task.status === "done");
    const onTimeTasks = doneTasks.filter(
      (task) => task.completedAt && task.completedAt <= task.dueAt,
    );
    const dueRuns = runRows.filter((run) => run.dueAt <= now);
    const doneRuns = dueRuns.filter((run) => run.status === "done");
    const closedIds = new Set(closed.map((wo) => wo.id));
    let partsCost = 0;
    for (const part of costRows) {
      if (!closedIds.has(part.workOrderId)) continue;
      const amount =
        part.amount !== null
          ? Number(part.amount)
          : part.unitPrice !== null
            ? Number(part.unitPrice) * part.quantity
            : 0;
      partsCost += amount;
    }
    const laborCost =
      (closed.reduce((sum, wo) => sum + (wo.laborMinutes ?? 0), 0) / 60) *
      LABOR_RATE_PER_HOUR;
    const stockValue = partRows.reduce(
      (sum, part) => sum + part.stockQty * Number(part.referencePrice ?? 0),
      0,
    );
    const lowStock = partRows.filter(
      (part) => part.active && part.stockQty < part.safetyStock,
    ).length;

    headers = ["指标", "数值", "说明"];
    rows = [
      ["统计周期", `${days} 天`, `数据截止 ${stamp(now)}`],
      ["已关闭工单", closed.length, `统计期新建或关闭`],
      ["工单及时率", fmtPercent(timely.length, closed.length), `${timely.length}/${closed.length}`],
      ["PM 按期率", fmtPercent(onTimeTasks.length, dueTasks.length), `${doneTasks.length}/${dueTasks.length} 已完成`],
      ["点检完成率", fmtPercent(doneRuns.length, dueRuns.length), `${doneRuns.length}/${dueRuns.length}`],
      ["非计划故障", unplanned.length, "剔除计划停机"],
      [
        "MTTR",
        unplanned.length ? fmtMinutes(unplannedMinutes / unplanned.length) : "—",
        "非计划停机总分钟 ÷ 次数",
      ],
      [
        "MTBF",
        unplanned.length
          ? fmtHours(
              Math.max(0, available - totalMinutes) / unplanned.length / 60,
            )
          : "—",
        "日历可用时间近似",
      ],
      ["设备可用率", `${(((available - unplannedMinutes) / available) * 100).toFixed(1)}%`, "按日历时间近似"],
      ["人工成本", money(laborCost), `${LABOR_RATE_PER_HOUR} 元/小时`],
      ["备件成本", money(partsCost), "工单领用金额"],
      ["维修总成本", money(laborCost + partsCost), "人工 + 备件"],
      ["库存金额", money(stockValue), `${lowStock} 种低库存`],
    ];
  } else if (report === "work-orders") {
    const [woRows, assetRows, userRows] = await Promise.all([
      db.select().from(workOrders).orderBy(asc(workOrders.createdAt)),
      db.select({ id: assets.id, code: assets.code, name: assets.name }).from(assets),
      db.select({ id: users.id, name: users.name }).from(users),
    ]);
    const assetMap = new Map(assetRows.map((row) => [row.id, row]));
    const userMap = new Map(userRows.map((row) => [row.id, row.name]));

    const periodRows = woRows.filter((wo) => {
      if (typeFilter && wo.type !== typeFilter) return false;
      if (priorityFilter && wo.priority !== priorityFilter) return false;
      if (assigneeFilter && wo.assigneeId !== assigneeFilter) return false;
      if (assetFilter && wo.assetId !== assetFilter) return false;
      return (
        wo.createdAt >= since ||
        (wo.completedAt !== null && wo.completedAt >= since) ||
        (wo.closedAt !== null && wo.closedAt >= since)
      );
    });

    headers = [
      "工单号",
      "标题",
      "设备编码",
      "设备名称",
      "类型",
      "优先级",
      "状态",
      "负责人",
      "创建时间",
      "期望完成",
      "完成时间",
      "关闭时间",
      "是否按期",
      "工时(分钟)",
      "停机(分钟)",
    ];
    rows = periodRows.map((wo) => {
      const finishedAt = wo.closedAt ?? wo.completedAt;
      return [
        wo.code,
        wo.title,
        assetMap.get(wo.assetId)?.code ?? "",
        assetMap.get(wo.assetId)?.name ?? "",
        WO_TYPE[wo.type]?.label ?? wo.type,
        PRIORITY[wo.priority]?.label ?? wo.priority,
        WO_STATUS[wo.status]?.label ?? wo.status,
        userMap.get(wo.assigneeId ?? "") ?? "",
        stamp(wo.createdAt),
        stamp(wo.dueAt),
        stamp(wo.completedAt),
        stamp(wo.closedAt),
        finishedAt && wo.dueAt ? (finishedAt <= wo.dueAt ? "是" : "否") : "",
        wo.laborMinutes ?? "",
        wo.downtimeMinutes ?? "",
      ];
    });
  } else if (report === "pm") {
    const [taskRows, assetRows] = await Promise.all([
      db
        .select({
          id: inspectionTasks.id,
          dueAt: inspectionTasks.dueAt,
          status: inspectionTasks.status,
          completedAt: inspectionTasks.completedAt,
          workOrderId: inspectionTasks.workOrderId,
          assetId: inspectionTasks.assetId,
          planName: maintenancePlans.name,
          planType: maintenancePlans.type,
          standardMinutes: maintenancePlans.standardMinutes,
          laborMinutes: workOrders.laborMinutes,
        })
        .from(inspectionTasks)
        .innerJoin(maintenancePlans, eq(inspectionTasks.planId, maintenancePlans.id))
        .leftJoin(workOrders, eq(inspectionTasks.workOrderId, workOrders.id))
        .where(and(gte(inspectionTasks.dueAt, since), lt(inspectionTasks.dueAt, now)))
        .orderBy(asc(inspectionTasks.dueAt)),
      db.select({ id: assets.id, code: assets.code, name: assets.name }).from(assets),
    ]);
    const assetMap = new Map(assetRows.map((row) => [row.id, row]));

    const filtered = taskRows.filter((task) => {
      if (planTypeFilter && task.planType !== planTypeFilter) return false;
      if (assetFilter && task.assetId !== assetFilter) return false;
      return true;
    });

    headers = [
      "到期时间",
      "计划名称",
      "类型",
      "设备编码",
      "设备名称",
      "状态",
      "完成时间",
      "是否按期",
      "转工单",
      "标准工时(分钟)",
      "实际工时(分钟)",
    ];
    rows = filtered.map((task) => [
      stamp(task.dueAt),
      task.planName,
      PLAN_TYPE[task.planType]?.label ?? task.planType,
      assetMap.get(task.assetId)?.code ?? "",
      assetMap.get(task.assetId)?.name ?? "",
      TASK_STATUS[task.status]?.label ?? task.status,
      stamp(task.completedAt),
      task.completedAt ? (task.completedAt <= task.dueAt ? "是" : "否") : "",
      task.workOrderId ? "是" : "否",
      task.standardMinutes ?? "",
      task.laborMinutes ?? "",
    ]);
  } else if (report === "inspection") {
    const runRows = await db
      .select({
        id: inspectionRuns.id,
        routeId: inspectionRuns.routeId,
        routeName: inspectionRoutes.name,
        status: inspectionRuns.status,
        dueAt: inspectionRuns.dueAt,
        completedAt: inspectionRuns.completedAt,
        executorName: inspectionRuns.executorName,
      })
      .from(inspectionRuns)
      .innerJoin(inspectionRoutes, eq(inspectionRuns.routeId, inspectionRoutes.id))
      .where(and(gte(inspectionRuns.dueAt, since), lt(inspectionRuns.dueAt, now)))
      .orderBy(asc(inspectionRuns.dueAt));

    const filtered = runRows.filter(
      (run) => !routeFilter || run.routeId === routeFilter,
    );
    headers = ["到期时间", "路线", "状态", "执行人", "完成时间", "是否按期"];
    rows = filtered.map((run) => [
      stamp(run.dueAt),
      run.routeName,
      RUN_STATUS[run.status]?.label ?? run.status,
      run.executorName ?? "",
      stamp(run.completedAt),
      run.completedAt ? (run.completedAt <= run.dueAt ? "是" : "否") : "",
    ]);
  } else if (report === "spare-parts") {
    const txnRows = await db
      .select({
        txn: inventoryTransactions,
        partCode: spareParts.code,
        partName: spareParts.name,
        category: spareParts.category,
        unit: spareParts.unit,
      })
      .from(inventoryTransactions)
      .innerJoin(spareParts, eq(inventoryTransactions.partId, spareParts.id))
      .where(gte(inventoryTransactions.createdAt, since))
      .orderBy(asc(inventoryTransactions.createdAt));

    const filtered = txnRows.filter(
      (row) => !categoryFilter || row.category === categoryFilter,
    );
    headers = [
      "时间",
      "类型",
      "备件编码",
      "备件名称",
      "类别",
      "数量",
      "单位",
      "金额",
      "操作人",
      "关联工单",
      "备注",
    ];
    rows = filtered.map((row) => [
      stamp(row.txn.createdAt),
      TXN_TYPE[row.txn.type]?.label ?? row.txn.type,
      row.partCode,
      row.partName,
      row.category,
      row.txn.quantity,
      row.unit,
      money(row.txn.amount),
      row.txn.operatorName ?? "",
      row.txn.workOrderId ?? "",
      row.txn.note ?? "",
    ]);
  } else if (report === "cost") {
    const [woRows, assetRows, partRows] = await Promise.all([
      db.select().from(workOrders),
      db.select({ id: assets.id, code: assets.code, name: assets.name }).from(assets),
      db
        .select({
          workOrderId: workOrderParts.workOrderId,
          quantity: workOrderParts.quantity,
          unitPrice: workOrderParts.unitPrice,
          amount: workOrderParts.amount,
        })
        .from(workOrderParts),
    ]);
    const assetMap = new Map(assetRows.map((row) => [row.id, row]));
    const partsMap = new Map<string, typeof partRows>();
    for (const part of partRows) {
      const list = partsMap.get(part.workOrderId) ?? [];
      list.push(part);
      partsMap.set(part.workOrderId, list);
    }
    const closed = woRows.filter(
      (wo) =>
        (wo.status === "completed" || wo.status === "closed") &&
        (wo.closedAt ?? wo.completedAt ?? wo.createdAt) >= since &&
        (!assetFilter || wo.assetId === assetFilter),
    );

    headers = [
      "工单号",
      "标题",
      "设备编码",
      "设备名称",
      "关闭时间",
      "工时(分钟)",
      "人工成本",
      "备件成本",
      "总成本",
      "成本完整性",
    ];
    rows = closed.map((wo) => {
      const parts = partsMap.get(wo.id) ?? [];
      let partsCost = 0;
      let complete = wo.laborMinutes !== null;
      for (const part of parts) {
        const amount =
          part.amount !== null
            ? Number(part.amount)
            : part.unitPrice !== null
              ? Number(part.unitPrice) * part.quantity
              : null;
        if (amount === null) complete = false;
        else partsCost += amount;
      }
      const laborCost = ((wo.laborMinutes ?? 0) / 60) * LABOR_RATE_PER_HOUR;
      return [
        wo.code,
        wo.title,
        assetMap.get(wo.assetId)?.code ?? "",
        assetMap.get(wo.assetId)?.name ?? "",
        stamp(wo.closedAt ?? wo.completedAt),
        wo.laborMinutes ?? "",
        money(laborCost),
        money(partsCost),
        money(laborCost + partsCost),
        complete ? "完整" : "不完整",
      ];
    });
  } else if (report === "faults") {
    const recordRows = await db
      .select({
        record: downtimeRecords,
        assetCode: assets.code,
        assetName: assets.name,
        code: faultCodes.code,
        codeName: faultCodes.name,
      })
      .from(downtimeRecords)
      .innerJoin(assets, eq(downtimeRecords.assetId, assets.id))
      .leftJoin(faultCodes, eq(downtimeRecords.faultCodeId, faultCodes.id))
      .where(gte(downtimeRecords.startedAt, since))
      .orderBy(asc(downtimeRecords.startedAt));

    const filtered = recordRows.filter(
      (row) =>
        (!assetFilter || row.record.assetId === assetFilter) &&
        (!codeFilter || row.record.faultCodeId === codeFilter),
    );

    headers = [
      "开始时间",
      "结束时间",
      "设备编码",
      "设备名称",
      "停机类型",
      "故障代码",
      "故障名称",
      "责任归属",
      "停机分钟",
      "影响产量",
      "关联工单",
      "备注",
    ];
    rows = filtered.map((row) => [
      stamp(row.record.startedAt),
      stamp(row.record.endedAt),
      row.assetCode,
      row.assetName,
      DOWNTIME_TYPE[row.record.type]?.label ?? row.record.type,
      row.code ?? "",
      row.codeName ?? "",
      RESPONSIBILITY[row.record.responsibility]?.label ?? row.record.responsibility,
      row.record.minutes,
      row.record.affectedOutput ?? "",
      row.record.workOrderId ?? "",
      row.record.note ?? "",
    ]);
  } else {
    return NextResponse.json({ error: "未知报表" }, { status: 404 });
  }

  await audit({
    entityType: "analytics",
    action: "analytics.export",
    actorId: user.id,
    actorName: user.name,
    detail: {
      report: reportKey,
      days,
      filters: {
        asset: assetFilter,
        code: codeFilter,
        route: routeFilter,
        assignee: assigneeFilter,
        type: typeFilter ?? planTypeFilter,
        priority: priorityFilter,
        category: categoryFilter,
      },
      rows: rows.length,
    },
  });

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(reportKey, now)}"`,
    },
  });
}
