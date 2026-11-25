import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  assetBom,
  assetDocuments,
  assetStatusHistory,
  assets,
  attachments,
  auditLogs,
  downtimeRecords,
  faultCodes,
  inspectionPoints,
  inspectionRunItems,
  inspectionRuns,
  inspectionRoutes,
  inspectionTasks,
  inspectionTemplates,
  integrationEndpoints,
  integrationMockMessages,
  inventoryTransactions,
  kbArticleVotes,
  kbArticles,
  locations,
  maintenancePlans,
  notifications,
  partBatches,
  pdmAlarms,
  pdmReadings,
  pdmRules,
  pdmSensors,
  pdmSuggestedWorkOrders,
  pmReadings,
  purchaseRequestItems,
  purchaseRequests,
  rateLimits,
  repairRequests,
  roles,
  spareParts,
  stocktakeItems,
  stocktakes,
  syncJobs,
  syncRecords,
  syncRuns,
  users,
  warehouses,
  workOrderEvents,
  workOrderParts,
  workOrders,
} from "./schema";

const token = () => randomBytes(12).toString("base64url");
const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
};

const priorDowntime = (daysAgo: number, minutes: number) => {
  const endedAt = daysFromNow(-daysAgo);
  return {
    startedAt: new Date(endedAt.getTime() - minutes * 60000),
    endedAt,
    minutes,
  };
};

async function main() {
  console.log("清理旧数据…");
  await db.delete(integrationMockMessages);
  await db.delete(syncRecords);
  await db.delete(syncRuns);
  await db.delete(syncJobs);
  await db.delete(integrationEndpoints);
  await db.delete(kbArticleVotes);
  await db.delete(kbArticles);
  await db.delete(pdmSuggestedWorkOrders);
  await db.delete(pdmAlarms);
  await db.delete(pdmRules);
  await db.delete(pdmReadings);
  await db.delete(pdmSensors);
  await db.delete(auditLogs);
  await db.delete(notifications);
  await db.delete(inspectionRunItems);
  await db.delete(inspectionRuns);
  await db.delete(inspectionPoints);
  await db.delete(inspectionRoutes);
  await db.delete(pmReadings);
  await db.delete(assetDocuments);
  await db.delete(assetStatusHistory);
  await db.delete(attachments);
  await db.delete(rateLimits);
  await db.delete(inspectionTasks);
  await db.delete(maintenancePlans);
  await db.delete(workOrderParts);
  await db.delete(downtimeRecords);
  await db.delete(stocktakeItems);
  await db.delete(stocktakes);
  await db.delete(purchaseRequestItems);
  await db.delete(purchaseRequests);
  await db.delete(inventoryTransactions);
  await db.delete(assetBom);
  await db.delete(partBatches);
  await db.delete(spareParts);
  await db.delete(warehouses);
  await db.delete(workOrderEvents);
  await db.delete(workOrders);
  await db.delete(faultCodes);
  await db.delete(repairRequests);
  await db.delete(inspectionTemplates);
  await db.delete(assets);
  await db.delete(locations);
  await db.delete(users);

  console.log("创建内置角色…");
  await db
    .insert(roles)
    .values([
      {
        id: "admin",
        name: "系统管理员",
        description: "全部业务权限，并可管理用户、角色与系统设置",
        tone: "ink",
        builtin: true,
        manage: true,
        repair: true,
        admin: true,
        sortOrder: 0,
      },
      {
        id: "manager",
        name: "维修主管",
        description: "负责分诊派工、验收关闭、计划与库存管理，可查看成本报表",
        tone: "accent",
        builtin: true,
        manage: true,
        repair: true,
        admin: false,
        sortOrder: 1,
      },
      {
        id: "technician",
        name: "维修工程师",
        description: "接单维修、完工签名、备件领用、点检与报警处理",
        tone: "mint",
        builtin: true,
        manage: false,
        repair: true,
        admin: false,
        sortOrder: 2,
      },
      {
        id: "viewer",
        name: "只读用户",
        description: "只读查看设备、工单、报表与通知，不能修改业务数据",
        tone: "neutral",
        builtin: true,
        manage: false,
        repair: false,
        admin: false,
        sortOrder: 3,
      },
    ])
    .onConflictDoNothing();

  console.log("创建用户…");
  const passwordHash = await bcrypt.hash("admin123", 10);
  const [, manager, techA, techB] = await db
    .insert(users)
    .values([
      {
        name: "陈益磊",
        email: "admin@cmms.local",
        passwordHash,
        role: "admin",
      },
      {
        name: "王主管",
        email: "manager@cmms.local",
        passwordHash,
        role: "manager",
      },
      {
        name: "李师傅",
        email: "tech1@cmms.local",
        passwordHash,
        role: "technician",
      },
      {
        name: "周师傅",
        email: "tech2@cmms.local",
        passwordHash,
        role: "technician",
      },
    ])
    .returning();

  console.log("创建位置…");
  const [shop1, shop2, power, warehouse] = await db
    .insert(locations)
    .values([
      { name: "一号车间", code: "C1", sort: 1 },
      { name: "二号车间", code: "C2", sort: 2 },
      { name: "动力站", code: "P1", sort: 3 },
      { name: "成品仓库", code: "W1", sort: 4 },
    ])
    .returning();

  console.log("创建设备树…");
  const [factory] = await db
    .insert(assets)
    .values({
      code: "FAC-01",
      name: "月立集团总部工厂",
      category: "工厂",
      level: "factory",
      responsibleName: "王主管",
      qrToken: token(),
    })
    .returning();

  const [ws1, ws2, ws3] = await db
    .insert(assets)
    .values([
      {
        code: "WS-01",
        name: "一号车间",
        category: "车间",
        level: "workshop",
        parentId: factory.id,
        responsibleName: "王主管",
        qrToken: token(),
      },
      {
        code: "WS-02",
        name: "二号车间",
        category: "车间",
        level: "workshop",
        parentId: factory.id,
        responsibleName: "王主管",
        qrToken: token(),
      },
      {
        code: "WS-03",
        name: "动力站",
        category: "车间",
        level: "workshop",
        parentId: factory.id,
        responsibleName: "周师傅",
        qrToken: token(),
      },
    ])
    .returning();

  const [line1, line2] = await db
    .insert(assets)
    .values([
      {
        code: "LINE-01",
        name: "A 注塑产线",
        category: "产线",
        level: "line",
        parentId: ws1.id,
        responsibleName: "李师傅",
        qrToken: token(),
      },
      {
        code: "LINE-02",
        name: "B 冲压装配线",
        category: "产线",
        level: "line",
        parentId: ws2.id,
        responsibleName: "周师傅",
        qrToken: token(),
      },
    ])
    .returning();

  console.log("创建设备…");
  const assetRows = await db
    .insert(assets)
    .values([
      {
        code: "EQ-0001",
        name: "一号注塑机",
        category: "注塑设备",
        level: "machine",
        parentId: line1.id,
        locationId: shop1.id,
        installLocation: "一号车间 A 线 1 号工位",
        responsibleName: "李师傅",
        manufacturer: "海天",
        vendor: "海天华南服务商",
        model: "MA2100",
        serialNo: "HT2100-88421",
        status: "in_service",
        criticality: "A",
        purchaseCost: "420000.00",
        depreciationMonths: 120,
        specs: {
          额定功率: "37kW",
          锁模力: "2100kN",
          油温上限: "55℃",
        },
        qrToken: token(),
        notes: "两班制运行，重点盯液压油温。",
      },
      {
        code: "EQ-0002",
        name: "二号注塑机",
        category: "注塑设备",
        level: "machine",
        parentId: line1.id,
        locationId: shop1.id,
        installLocation: "一号车间 A 线 2 号工位",
        responsibleName: "李师傅",
        manufacturer: "海天",
        model: "MA1600",
        serialNo: "HT1600-77103",
        status: "repairing",
        criticality: "A",
        purchaseCost: "360000.00",
        depreciationMonths: 120,
        qrToken: token(),
      },
      {
        code: "EQ-0003",
        name: "数控车床",
        category: "机加工设备",
        level: "machine",
        parentId: line1.id,
        locationId: shop1.id,
        responsibleName: "李师傅",
        manufacturer: "沈阳机床",
        model: "CAK4085",
        serialNo: "SY4085-2211",
        status: "in_service",
        criticality: "B",
        purchaseCost: "180000.00",
        depreciationMonths: 120,
        qrToken: token(),
      },
      {
        code: "EQ-0004",
        name: "高速冲床",
        category: "冲压设备",
        level: "machine",
        parentId: line2.id,
        locationId: shop2.id,
        responsibleName: "周师傅",
        manufacturer: "扬力",
        model: "JH21-110",
        serialNo: "YL110-0925",
        status: "maintenance",
        criticality: "A",
        purchaseCost: "280000.00",
        depreciationMonths: 120,
        qrToken: token(),
      },
      {
        code: "EQ-0005",
        name: "激光打标机",
        category: "标识设备",
        level: "machine",
        parentId: line2.id,
        locationId: shop2.id,
        responsibleName: "周师傅",
        manufacturer: "大族激光",
        model: "YLP-20",
        serialNo: "DZ20-5561",
        status: "in_service",
        criticality: "C",
        purchaseCost: "65000.00",
        depreciationMonths: 60,
        qrToken: token(),
      },
      {
        code: "EQ-0006",
        name: "自动装配线",
        category: "装配设备",
        level: "machine",
        parentId: line2.id,
        locationId: shop2.id,
        responsibleName: "周师傅",
        manufacturer: "非标定制",
        model: "ASM-3",
        serialNo: "ASM3-2024-01",
        status: "in_service",
        criticality: "A",
        purchaseCost: "860000.00",
        depreciationMonths: 120,
        qrToken: token(),
      },
      {
        code: "EQ-0007",
        name: "螺杆空压机",
        category: "动力设备",
        level: "machine",
        parentId: ws3.id,
        locationId: power.id,
        responsibleName: "周师傅",
        manufacturer: "阿特拉斯",
        model: "GA37",
        serialNo: "GA37-11802",
        status: "in_service",
        criticality: "A",
        purchaseCost: "150000.00",
        depreciationMonths: 120,
        qrToken: token(),
      },
      {
        code: "EQ-0008",
        name: "冷却塔",
        category: "动力设备",
        level: "machine",
        parentId: ws3.id,
        locationId: power.id,
        responsibleName: "周师傅",
        manufacturer: "金日",
        model: "JNT-200",
        serialNo: "JNT200-3307",
        status: "idle",
        criticality: "B",
        purchaseCost: "72000.00",
        depreciationMonths: 120,
        qrToken: token(),
      },
      {
        code: "EQ-0009",
        name: "工业烘干炉",
        category: "热处理设备",
        level: "machine",
        parentId: line2.id,
        locationId: shop2.id,
        responsibleName: "周师傅",
        manufacturer: "苏州烘炉",
        model: "HG-500",
        serialNo: "HG500-6612",
        status: "in_service",
        criticality: "B",
        purchaseCost: "230000.00",
        depreciationMonths: 120,
        qrToken: token(),
      },
      {
        code: "EQ-0010",
        name: "自动包装机",
        category: "包装设备",
        level: "machine",
        parentId: ws2.id,
        locationId: warehouse.id,
        responsibleName: "王主管",
        manufacturer: "永创",
        model: "YS-800",
        serialNo: "YC800-4410",
        status: "retired",
        criticality: "C",
        purchaseCost: "58000.00",
        depreciationMonths: 60,
        qrToken: token(),
      },
    ])
    .returning();

  console.log("创建部件…");
  await db.insert(assets).values([
    {
      code: "COMP-0001",
      name: "液压系统",
      category: "部件",
      level: "component",
      parentId: assetRows[0].id,
      responsibleName: "李师傅",
      qrToken: token(),
    },
    {
      code: "COMP-0002",
      name: "电控柜",
      category: "部件",
      level: "component",
      parentId: assetRows[0].id,
      responsibleName: "李师傅",
      qrToken: token(),
    },
  ]);

  const assetDates: Record<string, [string, string]> = {
    "EQ-0001": ["2021-03-12", "2026-03-12"],
    "EQ-0002": ["2021-03-12", "2026-03-12"],
    "EQ-0003": ["2022-08-05", "2025-08-05"],
    "EQ-0004": ["2020-11-20", "2025-11-20"],
    "EQ-0005": ["2023-02-14", "2026-02-14"],
    "EQ-0006": ["2024-05-09", "2027-05-09"],
    "EQ-0007": ["2018-09-01", "2023-09-01"],
    "EQ-0008": ["2017-04-22", "2022-04-22"],
    "EQ-0009": ["2022-12-01", "2025-12-01"],
    "EQ-0010": ["2016-06-30", "2021-06-30"],
  };
  for (const asset of assetRows) {
    const dates = assetDates[asset.code];
    if (!dates) continue;
    await db
      .update(assets)
      .set({
        purchaseDate: new Date(`${dates[0]}T00:00:00`),
        warrantyUntil: new Date(`${dates[1]}T00:00:00`),
      })
      .where(eq(assets.id, asset.id));
  }

  console.log("写入初始状态履历…");
  const historyRows = [factory, ws1, ws2, ws3, line1, line2, ...assetRows].map(
    (asset) => ({
      assetId: asset.id,
      fromStatus: null,
      toStatus: asset.status,
      reason: "种子数据建档",
      source: "seed",
      actorId: manager.id,
    }),
  );
  await db.insert(assetStatusHistory).values(historyRows);

  const assetByCode = Object.fromEntries(assetRows.map((a) => [a.code, a]));

  console.log("创建仓库与备件…");
  const [mainWh, shopWh] = await db
    .insert(warehouses)
    .values([
      {
        name: "主备件库",
        code: "WH-01",
        address: "厂区北侧备件库",
        managerName: "王主管",
      },
      {
        name: "车间备件柜",
        code: "WH-02",
        address: "一号车间工具间",
        managerName: "李师傅",
      },
    ])
    .returning();

  const partDefs = [
    {
      code: "SP-0001",
      name: "抗磨液压油 46#",
      category: "润滑油脂",
      spec: "200L / 桶",
      unit: "桶",
      brand: "壳牌",
      supplier: "华东润滑油",
      warehouse: "main",
      binCode: "A-01-01",
      safetyStock: 2,
      stockQty: 5,
      referencePrice: 2800,
      notes: "注塑机液压系统补油用。",
    },
    {
      code: "SP-0002",
      name: "哥林柱铜套",
      category: "机械件",
      spec: "MA2100 专用",
      unit: "件",
      brand: "海天",
      supplier: "海天华南服务商",
      warehouse: "main",
      binCode: "A-02-03",
      safetyStock: 4,
      stockQty: 2,
      referencePrice: 1200,
      notes: "合模机构易损件，A 类关键设备必备。",
    },
    {
      code: "SP-0003",
      name: "离合器摩擦片",
      category: "机械件",
      spec: "JH21-110",
      unit: "片",
      brand: "扬力",
      supplier: "扬力配件",
      warehouse: "main",
      binCode: "A-02-05",
      safetyStock: 6,
      stockQty: 4,
      referencePrice: 380,
      notes: "冲床离合器检修常换件。",
    },
    {
      code: "SP-0004",
      name: "空滤滤芯",
      category: "过滤耗材",
      spec: "GA37",
      unit: "个",
      brand: "阿特拉斯",
      supplier: "阿特拉斯服务商",
      warehouse: "main",
      binCode: "B-01-02",
      safetyStock: 4,
      stockQty: 8,
      referencePrice: 260,
    },
    {
      code: "SP-0005",
      name: "油分滤芯",
      category: "过滤耗材",
      spec: "GA37",
      unit: "个",
      brand: "阿特拉斯",
      supplier: "阿特拉斯服务商",
      warehouse: "main",
      binCode: "B-01-03",
      safetyStock: 2,
      stockQty: 1,
      referencePrice: 780,
      notes: "空压机月度保养必换。",
    },
    {
      code: "SP-0006",
      name: "接近开关",
      category: "电气件",
      spec: "LJ12A3-4-Z/BX",
      unit: "个",
      brand: "欧姆龙",
      supplier: "工控备件商",
      warehouse: "shop",
      binCode: "C-01-01",
      safetyStock: 10,
      stockQty: 16,
      referencePrice: 45,
    },
    {
      code: "SP-0007",
      name: "传动皮带",
      category: "传动件",
      spec: "A-42",
      unit: "条",
      brand: "三力士",
      supplier: "传动件商",
      warehouse: "shop",
      binCode: "C-02-01",
      safetyStock: 6,
      stockQty: 6,
      referencePrice: 35,
    },
    {
      code: "SP-0008",
      name: "安全门联锁开关",
      category: "电气件",
      spec: "D4NS-1AF",
      unit: "个",
      brand: "欧姆龙",
      supplier: "工控备件商",
      warehouse: "shop",
      binCode: "C-01-04",
      safetyStock: 3,
      stockQty: 2,
      referencePrice: 320,
      notes: "注塑机安全门联锁备件。",
    },
  ];

  const partRows = await db
    .insert(spareParts)
    .values(
      partDefs.map(({ warehouse, referencePrice, ...rest }) => ({
        ...rest,
        warehouseId: warehouse === "main" ? mainWh.id : shopWh.id,
        referencePrice: referencePrice.toFixed(2),
      })),
    )
    .returning();

  const partByCode = Object.fromEntries(partRows.map((p) => [p.code, p]));

  const batchDefs = [
    { code: "SP-0001", batchNo: "B-20260920-01", qty: 5 },
    { code: "SP-0002", batchNo: "B-20261008-01", qty: 1 },
    { code: "SP-0002", batchNo: "B-20261102-02", qty: 1 },
    { code: "SP-0003", batchNo: "B-20261012-01", qty: 4 },
    { code: "SP-0004", batchNo: "B-20260925-01", qty: 8 },
    { code: "SP-0005", batchNo: "B-20261018-01", qty: 1 },
    { code: "SP-0006", batchNo: "B-20261005-01", qty: 16 },
    { code: "SP-0007", batchNo: "B-20260915-01", qty: 4 },
    { code: "SP-0007", batchNo: "B-20261110-02", qty: 2 },
    { code: "SP-0008", batchNo: "B-20261022-01", qty: 2 },
  ];

  const batchRows = await db
    .insert(partBatches)
    .values(
      batchDefs.map(({ code, batchNo, qty }) => {
        const part = partByCode[code];
        return {
          partId: part.id,
          warehouseId: part.warehouseId,
          batchNo,
          quantity: qty,
          unitCost: part.referencePrice,
          receivedAt: daysFromNow(-40),
        };
      }),
    )
    .returning();

  const firstBatchByPart = new Map<string, string>();
  for (const batch of batchRows) {
    if (!firstBatchByPart.has(batch.partId)) {
      firstBatchByPart.set(batch.partId, batch.id);
    }
  }

  await db.insert(inventoryTransactions).values(
    partRows.map((part) => ({
      partId: part.id,
      batchId: firstBatchByPart.get(part.id),
      type: "in" as const,
      quantity: part.stockQty,
      unitCost: part.referencePrice,
      amount: (Number(part.referencePrice) * part.stockQty).toFixed(2),
      toWarehouseId: part.warehouseId,
      operatorId: manager.id,
      operatorName: "王主管",
      note: "种子期初入库",
      createdAt: daysFromNow(-40),
    })),
  );

  await db.insert(assetBom).values([
    {
      assetId: assetByCode["EQ-0001"].id,
      partId: partByCode["SP-0001"].id,
      quantity: 1,
      note: "液压油换油",
    },
    {
      assetId: assetByCode["EQ-0001"].id,
      partId: partByCode["SP-0002"].id,
      quantity: 1,
    },
    {
      assetId: assetByCode["EQ-0001"].id,
      partId: partByCode["SP-0006"].id,
      quantity: 2,
    },
    {
      assetId: assetByCode["EQ-0004"].id,
      partId: partByCode["SP-0003"].id,
      quantity: 2,
    },
    {
      assetId: assetByCode["EQ-0007"].id,
      partId: partByCode["SP-0004"].id,
      quantity: 1,
    },
    {
      assetId: assetByCode["EQ-0007"].id,
      partId: partByCode["SP-0005"].id,
      quantity: 1,
    },
    {
      assetId: assetByCode["EQ-0007"].id,
      partId: partByCode["SP-0007"].id,
      quantity: 2,
    },
  ]);

  const [stocktake] = await db
    .insert(stocktakes)
    .values({
      code: "ST-20261124-001",
      warehouseId: mainWh.id,
      status: "counting",
      createdById: manager.id,
      note: "主备件库月度盘点",
    })
    .returning();

  await db.insert(stocktakeItems).values(
    partRows
      .filter((part) => part.warehouseId === mainWh.id)
      .map((part) => ({
        stocktakeId: stocktake.id,
        partId: part.id,
        systemQty: part.stockQty,
      })),
  );

  const [
    purchaseRequest,
    approvedRequest,
    rejectedRequest,
    secondSubmitted,
  ] = await db
    .insert(purchaseRequests)
    .values([
      {
        code: "PR-20261124-001",
        status: "submitted",
        requestedById: techA.id,
        neededAt: daysFromNow(5),
        source: "auto_low_stock",
        note: "低库存自动补货建议",
      },
      {
        code: "PR-20261120-002",
        status: "approved",
        requestedById: techB.id,
        approvedById: manager.id,
        approvedAt: daysFromNow(-2),
        neededAt: daysFromNow(2),
        note: "冲床离合器检修备件",
        createdAt: daysFromNow(-4),
      },
      {
        code: "PR-20261118-003",
        status: "rejected",
        requestedById: techA.id,
        approvedById: manager.id,
        approvedAt: daysFromNow(-3),
        rejectedReason: "本月预算已满，先用库存替代件，下月再提。",
        neededAt: daysFromNow(7),
        note: "传动皮带备库",
        createdAt: daysFromNow(-5),
      },
      {
        code: "PR-20261123-004",
        status: "submitted",
        requestedById: techB.id,
        neededAt: daysFromNow(3),
        note: "安全门联锁开关补货",
        createdAt: daysFromNow(-1),
      },
    ])
    .returning();

  await db.insert(purchaseRequestItems).values([
    {
      requestId: purchaseRequest.id,
      partId: partByCode["SP-0002"].id,
      quantity: 4,
      unitCost: partByCode["SP-0002"].referencePrice,
      note: "低于安全库存",
    },
    {
      requestId: purchaseRequest.id,
      partId: partByCode["SP-0005"].id,
      quantity: 2,
      unitCost: partByCode["SP-0005"].referencePrice,
      note: "低于安全库存",
    },
    {
      requestId: approvedRequest.id,
      partId: partByCode["SP-0003"].id,
      quantity: 6,
      unitCost: partByCode["SP-0003"].referencePrice,
      note: "检修备件",
    },
    {
      requestId: rejectedRequest.id,
      partId: partByCode["SP-0007"].id,
      quantity: 10,
      unitCost: partByCode["SP-0007"].referencePrice,
      note: "常用易损件",
    },
    {
      requestId: secondSubmitted.id,
      partId: partByCode["SP-0008"].id,
      quantity: 5,
      unitCost: partByCode["SP-0008"].referencePrice,
      note: "低于安全库存",
    },
  ]);

  console.log("创建巡检模板…");
  const templates = await db
    .insert(inspectionTemplates)
    .values([
      {
        name: "注塑机日常点检",
        category: "注塑设备",
        items: [
          { label: "液压油位与油温", type: "check", required: true },
          { label: "锁模机构异响", type: "check", required: true },
          { label: "料筒温度", type: "number", required: true },
          { label: "安全门联锁", type: "check", required: true },
          { label: "现场清洁与漏油", type: "text" },
        ],
      },
      {
        name: "空压机月度保养",
        category: "动力设备",
        items: [
          { label: "空滤压差", type: "number", required: true },
          { label: "油分桶压差", type: "number", required: true },
          { label: "皮带张紧度", type: "check", required: true },
          { label: "排水阀动作", type: "check", required: true },
          { label: "运行电流", type: "number" },
        ],
      },
      {
        name: "电气安全季度检查",
        category: "通用",
        items: [
          { label: "接地电阻测试", type: "number", required: true },
          { label: "配电柜温升", type: "number" },
          { label: "线缆绝缘外观", type: "check", required: true },
          { label: "急停按钮功能", type: "check", required: true },
        ],
      },
    ])
    .returning();

  console.log("创建保养计划…");
  const plans = await db
    .insert(maintenancePlans)
    .values([
      {
        name: "注塑机日点检",
        assetId: assetByCode["EQ-0001"].id,
        templateId: templates[0].id,
        type: "inspection",
        triggerType: "time",
        cycleDays: 1,
        nextDueAt: daysFromNow(0),
        assigneeId: techA.id,
      },
      {
        name: "空压机月度保养",
        assetId: assetByCode["EQ-0007"].id,
        templateId: templates[1].id,
        type: "maintenance",
        triggerType: "time",
        cycleDays: 30,
        nextDueAt: daysFromNow(-1),
        standardMinutes: 120,
        requiredTools: "扭矩扳手、压差表",
        safetyNotes: "断电挂牌，泄压后再拆检。",
        assigneeId: techB.id,
      },
      {
        name: "车间电气季度检查",
        assetId: assetByCode["EQ-0006"].id,
        templateId: templates[2].id,
        type: "inspection",
        triggerType: "time",
        cycleDays: 90,
        nextDueAt: daysFromNow(6),
        assigneeId: techA.id,
      },
      {
        name: "注塑机运行 500 小时保养",
        assetId: assetByCode["EQ-0001"].id,
        templateId: templates[0].id,
        type: "maintenance",
        triggerType: "counter",
        counterType: "runtime_hours",
        counterInterval: 500,
        lastCounterReading: 1200,
        cycleDays: 30,
        nextDueAt: daysFromNow(14),
        standardMinutes: 90,
        assigneeId: techA.id,
      },
    ])
    .returning();

  await db.insert(pmReadings).values([
    {
      assetId: assetByCode["EQ-0001"].id,
      planId: plans[3].id,
      type: "runtime_hours",
      reading: 1200,
      note: "上次保养后读数",
      recordedById: techA.id,
      recordedAt: daysFromNow(-20),
    },
  ]);

  console.log("创建故障代码…");
  const faultCodeRows = await db
    .insert(faultCodes)
    .values([
      {
        code: "F001",
        name: "液压系统泄漏",
        category: "液压",
        phenomenon: "油管或接头渗油，系统压力下降",
        cause: "密封圈老化、接头松动、油管破损",
        countermeasure: "更换密封圈并紧固接头，试压 30 分钟",
        severity: "A",
      },
      {
        code: "F002",
        name: "轴承 / 铜套磨损",
        category: "机械",
        phenomenon: "运转异响、温升高、振动增大",
        cause: "润滑不足、轴承或铜套磨损超限",
        countermeasure: "补脂或更换轴承/铜套，复测振动与温度",
        severity: "A",
      },
      {
        code: "F003",
        name: "电气短路 / 跳闸",
        category: "电气",
        phenomenon: "设备跳闸、保险熔断、局部异味",
        cause: "线缆破损、受潮、负载过大",
        countermeasure: "排查线路绝缘，更换损坏元件并复测电流",
        severity: "A",
      },
      {
        code: "F004",
        name: "传感器失效",
        category: "控制",
        phenomenon: "信号丢失、误报警、定位偏差",
        cause: "传感器松动、污染、老化",
        countermeasure: "清洁并紧固传感器，必要时更换后校准",
        severity: "B",
      },
      {
        code: "F005",
        name: "气路堵塞 / 压力不足",
        category: "气动",
        phenomenon: "气缸动作缓慢、压力低、动作不到位",
        cause: "过滤器堵塞、管路漏气、调压阀异常",
        countermeasure: "清理过滤器，查漏并调整供气压力",
        severity: "B",
      },
      {
        code: "F006",
        name: "皮带打滑 / 断裂",
        category: "机械",
        phenomenon: "皮带异响、转速不稳、传动失效",
        cause: "张紧不足、皮带老化或磨损",
        countermeasure: "调整张紧度或更换皮带，复测传动",
        severity: "B",
      },
      {
        code: "F007",
        name: "离合器故障",
        category: "机械",
        phenomenon: "离合器打滑、送料不到位、异响",
        cause: "摩擦片磨损、间隙过大、气压不足",
        countermeasure: "更换摩擦片并调整间隙，空载试机",
        severity: "A",
      },
      {
        code: "F008",
        name: "控制系统报警",
        category: "控制",
        phenomenon: "HMI 报警、程序中断、轴停止",
        cause: "参数错误、通讯异常、驱动器报警",
        countermeasure: "复位报警，检查通讯与参数，必要时更换模块",
        severity: "B",
      },
      {
        code: "F009",
        name: "润滑不良",
        category: "机械",
        phenomenon: "导轨/丝杆干摩擦、温升、爬行",
        cause: "油路堵塞、油量不足、润滑泵故障",
        countermeasure: "疏通油路、补充润滑油，检查润滑泵",
        severity: "C",
      },
      {
        code: "F010",
        name: "安全联锁失效",
        category: "电气",
        phenomenon: "安全门打开仍可运行、联锁信号异常",
        cause: "开关损坏、线路短接、安装松动",
        countermeasure: "更换联锁开关并恢复线路，严禁短接",
        severity: "A",
      },
      {
        code: "F011",
        name: "冷却系统异常",
        category: "其他",
        phenomenon: "油温/水温偏高、冷却效率下降",
        cause: "冷却器堵塞、风扇故障、冷却液不足",
        countermeasure: "清洗冷却器，检查风扇与冷却液",
        severity: "B",
      },
      {
        code: "F012",
        name: "伺服驱动器故障",
        category: "电气",
        phenomenon: "驱动器报警、轴不动、定位丢失",
        cause: "过载、编码器故障、参数异常",
        countermeasure: "检查负载与编码器，必要时更换驱动器",
        severity: "A",
      },
    ])
    .returning();
  const faultByCode = Object.fromEntries(
    faultCodeRows.map((code) => [code.code, code]),
  );

  console.log("创建报修与工单…");
  const [req1, req2] = await db
    .insert(repairRequests)
    .values([
      {
        publicToken: token(),
        assetId: assetByCode["EQ-0002"].id,
        reporterName: "张丽",
        reporterPhone: "13800001234",
        description: "合模时听到明显异响，产品出现飞边，已停机。",
        priority: "high",
        status: "converted",
        createdAt: daysFromNow(-1),
      },
      {
        publicToken: token(),
        assetId: assetByCode["EQ-0004"].id,
        reporterName: "刘强",
        reporterPhone: "13900005678",
        description: "冲床离合器打滑，连续两模送料不到位。",
        priority: "urgent",
        status: "converted",
        createdAt: daysFromNow(-3),
      },
    ])
    .returning();

  const [wo1, wo2, wo3, wo4, , wo6] = await db
    .insert(workOrders)
    .values([
      {
        code: "WO-20261124-001",
        assetId: assetByCode["EQ-0002"].id,
        requestId: req1.id,
        type: "fault",
        title: "注塑机合模异响、产品飞边",
        description: "现场判断为哥林柱润滑不足，需检查铜套磨损。",
        status: "in_progress",
        priority: "high",
        assigneeId: techA.id,
        dueAt: daysFromNow(1),
        startedAt: daysFromNow(-1),
        faultCodeId: faultByCode["F002"].id,
        faultCode: "F002",
        faultPhenomenon: "合模异响、产品飞边",
        faultCause: "哥林柱润滑不足、铜套磨损",
        countermeasure: "补充润滑脂，检查并更换铜套",
        responsibility: "equipment",
        affectedOutput: 1200,
        createdAt: daysFromNow(-1),
      },
      {
        code: "WO-20261124-002",
        assetId: assetByCode["EQ-0004"].id,
        requestId: req2.id,
        type: "fault",
        title: "冲床离合器打滑",
        description: "需拆检离合器摩擦片，备件已在库。",
        status: "pending_acceptance",
        priority: "urgent",
        assigneeId: techB.id,
        dueAt: daysFromNow(0),
        startedAt: daysFromNow(-2),
        completedAt: daysFromNow(0),
        resolution: "更换摩擦片并调整间隙，空载试机 30 分钟正常。",
        downtimeMinutes: 185,
        laborMinutes: 210,
        signatureName: "周师傅",
        signatureAt: daysFromNow(0),
        faultCodeId: faultByCode["F007"].id,
        faultCode: "F007",
        faultPhenomenon: "离合器打滑、送料不到位",
        faultCause: "摩擦片磨损超限",
        countermeasure: "更换摩擦片并调整间隙",
        responsibility: "equipment",
        affectedOutput: 600,
        createdAt: daysFromNow(-3),
      },
      {
        code: "WO-20261124-003",
        assetId: assetByCode["EQ-0007"].id,
        type: "pm",
        title: "空压机月度保养",
        description: "按月度保养计划执行。\n检查项：空滤压差、油分桶压差、皮带张紧度、排水阀动作、运行电流",
        status: "assigned",
        priority: "medium",
        assigneeId: techB.id,
        planId: plans[1].id,
        dueAt: daysFromNow(-1),
        createdAt: daysFromNow(-2),
      },
      {
        code: "WO-20261124-004",
        assetId: assetByCode["EQ-0005"].id,
        type: "corrective",
        title: "打标机镜头清洁",
        description: "日常清洁，无异常。",
        status: "closed",
        priority: "low",
        assigneeId: techA.id,
        dueAt: daysFromNow(-4),
        startedAt: daysFromNow(-5),
        completedAt: daysFromNow(-5),
        closedAt: daysFromNow(-4),
        resolution: "清洁镜头与振镜，打标效果恢复正常。",
        downtimeMinutes: 15,
        laborMinutes: 25,
        signatureName: "李师傅",
        signatureAt: daysFromNow(-5),
        createdAt: daysFromNow(-6),
      },
      {
        code: "WO-20261124-005",
        assetId: assetByCode["EQ-0006"].id,
        type: "inspection",
        title: "装配线急停按钮误触发",
        description: "由点检任务转工单。急停按钮偶发误触发。",
        status: "new",
        priority: "high",
        dueAt: daysFromNow(3),
        faultCodeId: faultByCode["F010"].id,
        faultCode: "F010",
        faultPhenomenon: "急停按钮偶发误触发",
        responsibility: "equipment",
        createdAt: daysFromNow(0),
      },
      {
        code: "WO-20261124-006",
        assetId: assetByCode["EQ-0001"].id,
        type: "corrective",
        title: "[预测] 一号注塑机 · 主轴振动 严重报警",
        description:
          "由预测性维护建议转单。主轴振动近 24h 持续高于 7.1 mm/s，需检查轴承润滑与磨损，复测振动。",
        status: "assigned",
        priority: "high",
        assigneeId: techA.id,
        dueAt: daysFromNow(1),
        createdAt: daysFromNow(0),
      },
    ])
    .returning();

  await db.insert(workOrderEvents).values([
    {
      workOrderId: wo1.id,
      fromStatus: "assigned",
      toStatus: "in_progress",
      note: "已到场，开始拆检。",
      actorId: techA.id,
      createdAt: daysFromNow(-1),
    },
    {
      workOrderId: wo2.id,
      fromStatus: "in_progress",
      toStatus: "pending_acceptance",
      note: "维修完成，等待班组长验收。签名：周师傅",
      actorId: techB.id,
      createdAt: daysFromNow(0),
    },
    {
      workOrderId: wo4.id,
      fromStatus: "new",
      toStatus: "assigned",
      note: "派给李师傅。",
      actorId: manager.id,
      createdAt: daysFromNow(-6),
    },
    {
      workOrderId: wo4.id,
      fromStatus: "completed",
      toStatus: "closed",
      note: "验收通过。",
      actorId: manager.id,
      createdAt: daysFromNow(-4),
    },
    {
      workOrderId: wo3.id,
      fromStatus: null,
      toStatus: "assigned",
      note: "PM 到期自动建单",
      createdAt: daysFromNow(-2),
    },
    {
      workOrderId: wo6.id,
      fromStatus: null,
      toStatus: "assigned",
      note: "由预测性维护建议 PSW-20261124-002 转单",
      actorId: manager.id,
      createdAt: daysFromNow(0),
    },
  ]);

  await db.insert(workOrderParts).values([
    {
      workOrderId: wo1.id,
      partId: partByCode["SP-0001"].id,
      name: "抗磨液压油 46#",
      quantity: 1,
      unit: "桶",
      unitPrice: partByCode["SP-0001"].referencePrice,
      amount: "2800.00",
      note: "补加液压油",
    },
    {
      workOrderId: wo2.id,
      partId: partByCode["SP-0003"].id,
      name: "离合器摩擦片",
      quantity: 2,
      unit: "片",
      unitPrice: partByCode["SP-0003"].referencePrice,
      amount: "760.00",
      note: "更换摩擦片并调整间隙",
    },
  ]);

  await db.insert(inventoryTransactions).values([
    {
      partId: partByCode["SP-0001"].id,
      batchId: firstBatchByPart.get(partByCode["SP-0001"].id),
      type: "out",
      quantity: 1,
      unitCost: partByCode["SP-0001"].referencePrice,
      amount: "2800.00",
      fromWarehouseId: partByCode["SP-0001"].warehouseId,
      workOrderId: wo1.id,
      assetId: assetByCode["EQ-0002"].id,
      operatorId: techA.id,
      operatorName: "李师傅",
      note: "工单领用 WO-20261124-001",
      createdAt: daysFromNow(-1),
    },
    {
      partId: partByCode["SP-0003"].id,
      batchId: firstBatchByPart.get(partByCode["SP-0003"].id),
      type: "out",
      quantity: 2,
      unitCost: partByCode["SP-0003"].referencePrice,
      amount: "760.00",
      fromWarehouseId: partByCode["SP-0003"].warehouseId,
      workOrderId: wo2.id,
      assetId: assetByCode["EQ-0004"].id,
      operatorId: techB.id,
      operatorName: "周师傅",
      note: "工单领用 WO-20261124-002",
      createdAt: daysFromNow(0),
    },
  ]);

  console.log("创建停机记录…");
  await db.insert(downtimeRecords).values([
    {
      assetId: assetByCode["EQ-0004"].id,
      workOrderId: wo2.id,
      faultCodeId: faultByCode["F007"].id,
      type: "unplanned",
      responsibility: "equipment",
      ...priorDowntime(0, 185),
      affectedOutput: 600,
      note: "更换摩擦片并调整间隙",
      createdById: techB.id,
    },
    {
      assetId: assetByCode["EQ-0005"].id,
      workOrderId: wo4.id,
      type: "planned",
      responsibility: "other",
      ...priorDowntime(5, 15),
      affectedOutput: 0,
      note: "打标机镜头清洁",
      createdById: techA.id,
    },
    {
      assetId: assetByCode["EQ-0001"].id,
      faultCodeId: faultByCode["F001"].id,
      type: "unplanned",
      responsibility: "equipment",
      ...priorDowntime(3, 120),
      affectedOutput: 800,
      note: "液压油管接头渗油",
      createdById: techA.id,
    },
    {
      assetId: assetByCode["EQ-0007"].id,
      faultCodeId: faultByCode["F005"].id,
      type: "unplanned",
      responsibility: "operation",
      ...priorDowntime(5, 45),
      affectedOutput: 0,
      note: "气路过滤器堵塞，压力不足",
      createdById: techB.id,
    },
    {
      assetId: assetByCode["EQ-0005"].id,
      faultCodeId: faultByCode["F004"].id,
      type: "unplanned",
      responsibility: "equipment",
      ...priorDowntime(1, 60),
      affectedOutput: 300,
      note: "定位传感器松动",
      createdById: techA.id,
    },
    {
      assetId: assetByCode["EQ-0003"].id,
      faultCodeId: faultByCode["F003"].id,
      type: "unplanned",
      responsibility: "equipment",
      ...priorDowntime(8, 90),
      affectedOutput: 400,
      note: "控制柜线路受潮跳闸",
      createdById: techB.id,
    },
    {
      assetId: assetByCode["EQ-0008"].id,
      faultCodeId: faultByCode["F006"].id,
      type: "unplanned",
      responsibility: "equipment",
      ...priorDowntime(12, 75),
      affectedOutput: 200,
      note: "传动皮带老化打滑",
      createdById: techA.id,
    },
    {
      assetId: assetByCode["EQ-0007"].id,
      type: "planned",
      responsibility: "other",
      ...priorDowntime(20, 240),
      note: "空压机月度保养",
      createdById: techB.id,
    },
    {
      assetId: assetByCode["EQ-0009"].id,
      type: "planned",
      responsibility: "other",
      ...priorDowntime(15, 120),
      note: "冷却系统清洗",
      createdById: techA.id,
    },
  ]);

  console.log("创建预测性维护测点与读数…");
  const now = new Date();
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 3600000);

  const pdmSensorRows = await db
    .insert(pdmSensors)
    .values([
      {
        assetId: assetByCode["EQ-0001"].id,
        code: "PDMS-01",
        name: "主轴振动",
        metric: "vibration",
        unit: "mm/s",
        installLocation: "主轴前端轴承座",
      },
      {
        assetId: assetByCode["EQ-0001"].id,
        code: "PDMS-02",
        name: "液压油温",
        metric: "temperature",
        unit: "℃",
        installLocation: "液压油箱回油口",
      },
      {
        assetId: assetByCode["EQ-0007"].id,
        code: "PDMS-03",
        name: "排气温度",
        metric: "temperature",
        unit: "℃",
        installLocation: "空压机排气管",
      },
      {
        assetId: assetByCode["EQ-0007"].id,
        code: "PDMS-04",
        name: "主电机电流",
        metric: "current",
        unit: "A",
        installLocation: "主电机配电柜",
      },
      {
        assetId: assetByCode["EQ-0004"].id,
        code: "PDMS-05",
        name: "机身振动",
        metric: "vibration",
        unit: "mm/s",
        installLocation: "冲床机身地脚",
      },
    ])
    .returning();
  const pdmSensorByCode = Object.fromEntries(
    pdmSensorRows.map((sensor) => [sensor.code, sensor]),
  );

  const pdmSeries: Record<string, number[]> = {
    "PDMS-01": [4.2, 4.4, 4.1, 4.5, 4.8, 5.1, 5.3, 6.9, 7.2, 7.4, 7.5, 7.6, 7.8],
    "PDMS-02": [45, 46, 45, 47, 48, 49, 50, 52, 54, 56, 57, 58, 58.4],
    "PDMS-03": [82, 83, 81, 84, 85, 86, 88, 89, 90, 91, 92, 93, 94],
    "PDMS-04": [18, 18.5, 18.2, 18.8, 19.1, 19.4, 19.8, 20.2, 20.6, 21, 21.4, 21.8, 22.2],
    "PDMS-05": [3.1, 3.0, 3.2, 3.1, 3.0, 3.1, 3.2, 3.0, 3.1, 3.2, 3.1, 3.0, 3.1],
  };
  const pdmReadingValues: {
    sensorId: string;
    value: string;
    recordedAt: Date;
    source: string;
  }[] = [];
  for (const [code, values] of Object.entries(pdmSeries)) {
    const sensor = pdmSensorByCode[code];
    if (!sensor) continue;
    values.forEach((value, index) => {
      pdmReadingValues.push({
        sensorId: sensor.id,
        value: value.toFixed(3),
        recordedAt: hoursAgo((values.length - 1 - index) * 2),
        source: "iot",
      });
    });
  }
  await db.insert(pdmReadings).values(pdmReadingValues);

  const pdmRuleRows = await db
    .insert(pdmRules)
    .values([
      {
        sensorId: pdmSensorByCode["PDMS-02"].id,
        name: "液压油温预警",
        mode: "threshold",
        direction: "above",
        threshold: "55",
        severity: "warning",
        note: "油温高于 55℃ 持续观察冷却系统。",
      },
      {
        sensorId: pdmSensorByCode["PDMS-01"].id,
        name: "主轴振动持续超限",
        mode: "duration",
        direction: "above",
        threshold: "7.1",
        durationMinutes: 120,
        severity: "critical",
        note: "持续 2 小时高于 7.1 mm/s，检查轴承润滑与磨损。",
      },
      {
        sensorId: pdmSensorByCode["PDMS-04"].id,
        name: "主电机电流上升趋势",
        mode: "slope",
        direction: "above",
        slopePerDay: "2",
        severity: "warning",
        note: "电流按天上涨超过 2A，排查负载与电气连接。",
      },
      {
        sensorId: pdmSensorByCode["PDMS-03"].id,
        name: "排气高温组合条件",
        mode: "combined",
        direction: "above",
        threshold: "95",
        durationMinutes: 120,
        severity: "critical",
        note: "高于 95℃ 且持续 2 小时，检查冷却器与油分。",
      },
    ])
    .returning();
  const ruleOf = (code: string) =>
    pdmRuleRows.find(
      (rule) => rule.sensorId === pdmSensorByCode[code]?.id,
    )!;

  console.log("创建预测报警与建议工单…");
  const [pdmAlarm1, pdmAlarm2] = await db
    .insert(pdmAlarms)
    .values([
      {
        ruleId: ruleOf("PDMS-02").id,
        sensorId: pdmSensorByCode["PDMS-02"].id,
        assetId: assetByCode["EQ-0001"].id,
        severity: "warning",
        status: "open",
        value: "58.400",
        threshold: "55.000",
        message: "最新读数 58.4 ℃ 高于阈值 55 ℃",
        occurrences: 4,
        triggeredAt: hoursAgo(8),
        lastTriggeredAt: hoursAgo(2),
      },
      {
        ruleId: ruleOf("PDMS-01").id,
        sensorId: pdmSensorByCode["PDMS-01"].id,
        assetId: assetByCode["EQ-0001"].id,
        severity: "critical",
        status: "converted",
        value: "7.800",
        threshold: "7.100",
        message: "近 120 分钟读数持续高于 7.1 mm/s",
        occurrences: 3,
        triggeredAt: hoursAgo(10),
        lastTriggeredAt: hoursAgo(2),
        acknowledgedById: techA.id,
        acknowledgedAt: hoursAgo(1),
      },
    ])
    .returning();

  await db.insert(pdmSuggestedWorkOrders).values([
    {
      code: "PSW-20261124-001",
      assetId: assetByCode["EQ-0001"].id,
      alarmId: pdmAlarm1.id,
      title: "[预测] 一号注塑机 · 液压油温 预警报警",
      description: [
        "测点：PDMS-02 液压油温（℃）",
        "规则：液压油温预警",
        "报警：最新读数 58.4 ℃ 高于阈值 55 ℃",
        "建议：检查冷却水路、冷却器与油温传感器，确认油温回落后复测。",
        "来源：预测性维护建议（需人工确认后执行，不自动停机）",
      ].join("\n"),
      priority: "medium",
      status: "pending",
      createdById: manager.id,
      createdAt: hoursAgo(2),
    },
    {
      code: "PSW-20261124-002",
      assetId: assetByCode["EQ-0001"].id,
      alarmId: pdmAlarm2.id,
      title: "[预测] 一号注塑机 · 主轴振动 严重报警",
      description: [
        "测点：PDMS-01 主轴振动（mm/s）",
        "规则：主轴振动持续超限",
        "报警：近 120 分钟读数持续高于 7.1 mm/s",
        "建议：检查主轴轴承润滑与磨损，停机窗口内复测振动。",
        "来源：预测性维护建议（需人工确认后执行，不自动停机）",
      ].join("\n"),
      priority: "high",
      status: "converted",
      convertedWorkOrderId: wo6.id,
      createdById: manager.id,
      handledAt: hoursAgo(1),
      note: "已确认转维修工单",
      createdAt: hoursAgo(3),
    },
  ]);

  await db.insert(inspectionTasks).values([
    {
      planId: plans[0].id,
      assetId: assetByCode["EQ-0001"].id,
      templateId: templates[0].id,
      type: "inspection",
      dueAt: daysFromNow(0),
      status: "pending",
      assigneeId: techA.id,
    },
    {
      planId: plans[0].id,
      assetId: assetByCode["EQ-0003"].id,
      templateId: templates[0].id,
      type: "inspection",
      dueAt: daysFromNow(-1),
      status: "done",
      assigneeId: techA.id,
      completedAt: daysFromNow(-1),
      executorName: "李师傅",
      note: "各项正常。",
      result: {
        "液压油位与油温": "正常",
        "锁模机构异响": "正常",
        "料筒温度": "215",
        "安全门联锁": "正常",
      },
    },
    {
      planId: plans[2].id,
      assetId: assetByCode["EQ-0006"].id,
      templateId: templates[2].id,
      type: "inspection",
      dueAt: daysFromNow(6),
      status: "pending",
      assigneeId: techA.id,
    },
  ]);

  console.log("创建点检路线…");
  const [route1] = await db
    .insert(inspectionRoutes)
    .values([
      {
        name: "一号车间早班点检线",
        publicToken: token(),
        cycleDays: 1,
        assigneeId: techA.id,
      },
    ])
    .returning();

  const points = await db
    .insert(inspectionPoints)
    .values([
      {
        routeId: route1.id,
        assetId: assetByCode["EQ-0001"].id,
        name: "液压油位",
        checkType: "check",
        photoRequired: true,
        sort: 10,
        note: "油位在上下刻度之间",
      },
      {
        routeId: route1.id,
        assetId: assetByCode["EQ-0001"].id,
        name: "料筒温度",
        checkType: "number",
        standardMin: "180",
        standardMax: "230",
        unit: "℃",
        sort: 20,
      },
      {
        routeId: route1.id,
        assetId: assetByCode["EQ-0001"].id,
        name: "安全门联锁",
        checkType: "check",
        sort: 30,
        note: "开门即停机",
      },
      {
        routeId: route1.id,
        assetId: assetByCode["EQ-0003"].id,
        name: "主轴温度",
        checkType: "number",
        standardMax: "70",
        unit: "℃",
        sort: 40,
      },
      {
        routeId: route1.id,
        assetId: assetByCode["EQ-0003"].id,
        name: "运行异响",
        checkType: "check",
        sort: 50,
      },
    ])
    .returning();

  const [run1] = await db
    .insert(inspectionRuns)
    .values([
      {
        routeId: route1.id,
        status: "done",
        dueAt: daysFromNow(-1),
        executorName: "李师傅",
        startedAt: daysFromNow(-1),
        completedAt: daysFromNow(-1),
        note: "早班点检完成，各项正常。",
        createdAt: daysFromNow(-1),
      },
      {
        routeId: route1.id,
        status: "pending",
        dueAt: daysFromNow(-2),
        createdAt: daysFromNow(-2),
      },
    ])
    .returning();

  await db.insert(inspectionRunItems).values(
    points.map((point) => ({
      runId: run1.id,
      pointId: point.id,
      value: point.checkType === "number" ? (point.unit === "℃" ? "205" : "55") : "正常",
      status: "ok" as const,
      note: null,
    })),
  );

  await db.insert(notifications).values([
    {
      userId: techA.id,
      title: "新工单：注塑机合模异响、产品飞边",
      body: "有一张工单已派给你，请及时接单。",
      link: `/app/work-orders/${wo1.id}`,
    },
    {
      userId: techB.id,
      title: "PM 到期：空压机月度保养",
      body: "预防性维护已自动生成工单，请按模板执行。",
      link: `/app/work-orders/${wo3.id}`,
    },
    {
      userId: manager.id,
      title: "待验收：冲床离合器打滑",
      body: "周师傅已提交验收，请及时确认。",
      link: `/app/work-orders/${wo2.id}`,
      readAt: daysFromNow(-1),
    },
  ]);

  await db.insert(auditLogs).values([
    {
      entityType: "work_order",
      entityId: wo2.id,
      action: "work_order.sign",
      detail: { signatureName: "周师傅" },
      actorId: techB.id,
      actorName: "周师傅",
      createdAt: daysFromNow(0),
    },
    {
      entityType: "work_order",
      entityId: wo3.id,
      action: "work_order.pm_auto",
      detail: { planId: plans[1].id },
      createdAt: daysFromNow(-2),
    },
    {
      entityType: "asset",
      entityId: assetByCode["EQ-0001"].id,
      action: "asset.status",
      detail: { from: "in_service", to: "in_service", reason: "种子数据" },
      actorId: manager.id,
      actorName: "王主管",
      createdAt: daysFromNow(-3),
    },
  ]);

  console.log("创建设备知识库…");
  const kbRows = await db
    .insert(kbArticles)
    .values([
      {
        code: "KB-0001",
        title: "注塑机液压油温过高：从冷却水到油质的排查顺序",
        summary:
          "油温持续超过 55℃ 先别急着换油，按冷却水、冷却器、油质三步排查，八成能在半小时内定位。",
        category: "fault_case",
        content: [
          "## 故障现象",
          "一号注塑机连续两班运行后油温报警，HMI 显示 58℃，合模速度变慢，产品出现轻微飞边。",
          "",
          "## 排查顺序",
          "1. 先看冷却水：进水阀是否全开、水温是否偏高、回水管是否有流量。",
          "2. 再查冷却器：拆下进出水软管，用压缩空气反吹，观察是否堵塞。",
          "3. 最后看油质：取油样观察颜色与杂质，油品乳化或黏度明显下降时安排换油。",
          "",
          "## 本次原因",
          "冷却器内部结垢，回水流量只有正常值的一半。清洗冷却器后油温回落到 46℃。",
          "",
          "## 预防建议",
          "- 每季度反吹冷却器一次，水质差的车间缩短到每月。",
          "- 油温报警后不要直接补油降温，先确认冷却回路。",
        ].join("\n"),
        assetId: assetByCode["EQ-0001"].id,
        assetCategory: "注塑设备",
        faultCodeId: faultByCode["F011"].id,
        tags: "油温,液压,冷却器",
        status: "published",
        authorId: manager.id,
        authorName: "王主管",
        views: 46,
        helpfulCount: 3,
        publishedAt: daysFromNow(-18),
        updatedAt: daysFromNow(-6),
      },
      {
        code: "KB-0002",
        title: "冲床离合器打滑更换摩擦片作业步骤",
        summary:
          "从工单 WO-20261124-002 沉淀：断电上锁、拆防护罩、测量间隙、成组更换摩擦片，空载试机 30 分钟。",
        category: "repair_plan",
        content: [
          "## 适用场景",
          "冲床出现离合器打滑、送料不到位、飞轮空转但滑块不动，且调整气压后仍无改善。",
          "",
          "## 安全要求",
          "- 停机、断电、上锁挂牌，释放飞轮余压。",
          "- 佩戴防割手套，摩擦片粉尘用吸尘器清理，禁止用压缩空气吹。",
          "",
          "## 作业步骤",
          "1. 拆除离合器防护罩，标记气管与线束位置。",
          "2. 测量摩擦片与压盘间隙，超过 1.2mm 或片厚低于下限即更换。",
          "3. 摩擦片成组更换，清洁压盘油污，按对角顺序分次紧固。",
          "4. 恢复气管，调整气压至 0.55MPa，手动盘车确认无卡滞。",
          "5. 空载试机 30 分钟，连续冲 20 次确认无打滑、无异响。",
          "",
          "## 验收标准",
          "送料到位、无异响、离合器温度正常，验收单由当班组长签字。",
        ].join("\n"),
        assetId: assetByCode["EQ-0004"].id,
        assetCategory: "冲压设备",
        faultCodeId: faultByCode["F007"].id,
        tags: "冲床,离合器,摩擦片",
        status: "published",
        sourceWorkOrderId: wo2.id,
        authorId: techB.id,
        authorName: "周师傅",
        views: 34,
        helpfulCount: 2,
        unhelpfulCount: 1,
        publishedAt: daysFromNow(-12),
        updatedAt: daysFromNow(-2),
      },
      {
        code: "KB-0003",
        title: "注塑机合模异响与哥林柱铜套润滑检查",
        summary:
          "合模异响先查润滑，再测铜套间隙；补脂后仍有异响应安排停机检查，避免拉伤哥林柱。",
        category: "fault_case",
        content: [
          "## 现象",
          "二号注塑机合模段出现周期性异响，产品飞边增多，振动测点数值同步上升。",
          "",
          "## 原因",
          "哥林柱润滑不足，铜套局部磨损，间隙偏大导致合模时导向不稳。",
          "",
          "## 处理",
          "1. 清洁哥林柱表面，补注专用润滑脂。",
          "2. 用塞尺测量铜套间隙，超过厂家上限则更换铜套。",
          "3. 低速空载合模 20 次，复测振动与异响。",
          "",
          "## 注意",
          "不要只补脂不测间隙；铜套磨损后继续运行会拉伤哥林柱，维修成本翻倍。",
        ].join("\n"),
        assetId: assetByCode["EQ-0002"].id,
        assetCategory: "注塑设备",
        faultCodeId: faultByCode["F002"].id,
        tags: "合模,异响,铜套,润滑",
        status: "published",
        sourceWorkOrderId: wo1.id,
        authorId: techA.id,
        authorName: "李师傅",
        views: 27,
        helpfulCount: 2,
        publishedAt: daysFromNow(-9),
        updatedAt: daysFromNow(-1),
      },
      {
        code: "KB-0004",
        title: "螺杆空压机月度保养标准作业",
        summary:
          "空滤压差、油分桶压差、皮带张紧度、排水阀、运行电流五项必查，附上锁挂牌要求。",
        category: "operation",
        content: [
          "## 保养前",
          "- 停机并等待机组完全泄压，断电上锁挂牌。",
          "- 确认油分桶压力表归零后再开盖。",
          "",
          "## 五项检查",
          "1. 空滤压差：超过 0.1MPa 或滤芯明显积尘时更换。",
          "2. 油分桶压差：超过 0.12MPa 安排更换油分。",
          "3. 皮带张紧度：按压中点下沉 10-15mm 为正常。",
          "4. 排水阀：手动测试动作，清理自动排水口杂质。",
          "5. 运行电流：三相不平衡超过 10% 需排查。",
          "",
          "## 保养后",
          "恢复送电，空载运行 10 分钟，记录排气温度、压力与电流。",
        ].join("\n"),
        assetId: assetByCode["EQ-0007"].id,
        assetCategory: "动力设备",
        tags: "空压机,保养,上锁挂牌",
        status: "published",
        authorId: manager.id,
        authorName: "王主管",
        views: 52,
        helpfulCount: 3,
        publishedAt: daysFromNow(-25),
        updatedAt: daysFromNow(-10),
      },
      {
        code: "KB-0005",
        title: "维修前上锁挂牌（LOTO）安全要求",
        summary:
          "任何进入设备危险区域的维修都必须执行：断电、泄压、上锁、挂牌、验证零能量。",
        category: "safety",
        content: [
          "## 必须执行的情形",
          "- 进入冲床、注塑机、装配线等设备的运动或带电区域。",
          "- 拆卸带压管路、热媒管路或储能部件。",
          "",
          "## 五个步骤",
          "1. 停机：按正常停机顺序停止设备。",
          "2. 隔离：断开主电源、气源、液压源。",
          "3. 上锁：每人一把锁，钥匙自行保管。",
          "4. 挂牌：注明维修人、时间与原因。",
          "5. 验证：试启动确认无动作，压力表归零。",
          "",
          "## 禁止事项",
          "- 严禁只按急停不隔离能源。",
          "- 严禁借用他人锁具或代管钥匙。",
          "- 严禁短接安全联锁进行试机。",
        ].join("\n"),
        tags: "安全,上锁挂牌,LOTO",
        status: "published",
        authorId: manager.id,
        authorName: "王主管",
        views: 71,
        helpfulCount: 3,
        publishedAt: daysFromNow(-30),
        updatedAt: daysFromNow(-15),
      },
      {
        code: "KB-0006",
        title: "冲床离合器摩擦片替代与库存对照",
        summary:
          "原厂摩擦片交期长时，可按尺寸与摩擦系数选替代件，但必须成组更换并重新测量间隙。",
        category: "part_alternative",
        content: [
          "## 可替代条件",
          "- 外径、内径、厚度与原厂件一致，偏差不超过 0.1mm。",
          "- 摩擦系数与耐温等级不低于原厂参数。",
          "- 同一台设备必须成组更换，不得新旧混用。",
          "",
          "## 库存对照",
          "- 常用规格已在备件台账建立安全库存，领用时核对批次。",
          "- 替代件首次使用需记录运行 72 小时后的间隙变化。",
          "",
          "## 限制",
          "安全相关部件（联锁、制动）不得使用未经确认的替代件。",
        ].join("\n"),
        assetId: assetByCode["EQ-0004"].id,
        assetCategory: "冲压设备",
        faultCodeId: faultByCode["F007"].id,
        tags: "摩擦片,替代,备件",
        status: "published",
        authorId: techB.id,
        authorName: "周师傅",
        views: 18,
        helpfulCount: 1,
        publishedAt: daysFromNow(-5),
        updatedAt: daysFromNow(-3),
      },
      {
        code: "KB-0007",
        title: "激光打标机镜片清洁与光路检查（草稿）",
        summary: "打标变浅时先清洁镜片，再检查焦距与光路，避免直接调功率。",
        category: "operation",
        content: [
          "## 待补充",
          "1. 清洁工具与耗材清单。",
          "2. 镜片拆卸顺序与禁止动作。",
          "3. 清洁后的打标效果验证。",
        ].join("\n"),
        assetId: assetByCode["EQ-0005"].id,
        assetCategory: "标识设备",
        tags: "打标机,镜片,清洁",
        status: "draft",
        authorId: techA.id,
        authorName: "李师傅",
        updatedAt: daysFromNow(-2),
      },
      {
        code: "KB-0008",
        title: "注塑机料筒温度异常排查（草稿）",
        summary: "区分加热圈、热电偶与温控模块故障的快速判断方法。",
        category: "fault_case",
        content: [
          "## 现象",
          "料筒某段温度不升或波动超过 ±5℃。",
          "",
          "## 待补充",
          "- 加热圈电阻测量方法。",
          "- 热电偶与温控模块的替换验证顺序。",
        ].join("\n"),
        assetId: assetByCode["EQ-0001"].id,
        assetCategory: "注塑设备",
        tags: "料筒,温度,热电偶",
        status: "draft",
        authorId: techA.id,
        authorName: "李师傅",
        updatedAt: daysFromNow(-1),
      },
    ])
    .returning({ id: kbArticles.id, code: kbArticles.code });

  const kbByCode = Object.fromEntries(kbRows.map((row) => [row.code, row]));

  await db.insert(kbArticleVotes).values([
    { articleId: kbByCode["KB-0001"].id, userId: manager.id, helpful: true },
    { articleId: kbByCode["KB-0001"].id, userId: techA.id, helpful: true },
    { articleId: kbByCode["KB-0001"].id, userId: techB.id, helpful: true },
    { articleId: kbByCode["KB-0002"].id, userId: manager.id, helpful: true },
    { articleId: kbByCode["KB-0002"].id, userId: techA.id, helpful: true },
    { articleId: kbByCode["KB-0002"].id, userId: techB.id, helpful: false },
    { articleId: kbByCode["KB-0003"].id, userId: manager.id, helpful: true },
    { articleId: kbByCode["KB-0003"].id, userId: techB.id, helpful: true },
    { articleId: kbByCode["KB-0004"].id, userId: techA.id, helpful: true },
    { articleId: kbByCode["KB-0005"].id, userId: manager.id, helpful: true },
    { articleId: kbByCode["KB-0005"].id, userId: techA.id, helpful: true },
    { articleId: kbByCode["KB-0005"].id, userId: techB.id, helpful: true },
    { articleId: kbByCode["KB-0006"].id, userId: techA.id, helpful: true },
  ]);

  console.log("创建集成端点与同步任务…");
  const [mesEndpoint, erpEndpoint, wmsEndpoint] = await db
    .insert(integrationEndpoints)
    .values([
      {
        code: "MES-MOCK",
        name: "MES 生产系统（Mock）",
        system: "mes",
        baseUrl: "http://mes.mock.local/api",
        authType: "token",
        token: "mock-mes-token",
        mock: true,
        enabled: true,
        note: "安灯报修、完工回传联调；切换真实地址时关闭 Mock 并替换令牌。",
      },
      {
        code: "ERP-MOCK",
        name: "ERP 主数据（Mock）",
        system: "erp",
        baseUrl: "http://erp.mock.local/api",
        authType: "token",
        token: "mock-erp-token",
        mock: true,
        enabled: true,
        note: "设备主数据与状态回传，按设备编码对账。",
      },
      {
        code: "WMS-MOCK",
        name: "WMS 仓储（Mock）",
        system: "wms",
        baseUrl: "http://wms.mock.local/api",
        authType: "token",
        token: "mock-wms-token",
        mock: true,
        enabled: false,
        note: "备件领用推送，待仓储接口就绪后启用。",
      },
    ])
    .returning();

  const [, assetPushJob] = await db
    .insert(syncJobs)
    .values([
        {
          code: "SYNC-MES-WO-PULL",
          name: "MES 报修工单拉取",
          endpointId: mesEndpoint.id,
          dataset: "work_order",
          direction: "pull",
          intervalMinutes: 15,
          note: "安灯触发后 15 分钟内拉取，自动建故障工单并通知主管。",
        },
        {
          code: "SYNC-ERP-ASSET-PUSH",
          name: "ERP 设备主数据推送",
          endpointId: erpEndpoint.id,
          dataset: "asset_master",
          direction: "push",
          intervalMinutes: 60,
          note: "设备新增或主档变更时推送，按数据版本幂等。",
        },
        {
          code: "SYNC-ERP-ASSET-PULL",
          name: "ERP 设备状态回传",
          endpointId: erpEndpoint.id,
          dataset: "asset_master",
          direction: "pull",
          intervalMinutes: 30,
          note: "ERP 调整设备状态后回写台账，并记录状态履历。",
        },
        {
          code: "SYNC-MES-WO-PUSH",
          name: "MES 完工工单回传",
          endpointId: mesEndpoint.id,
          dataset: "work_order",
          direction: "push",
          intervalMinutes: 60,
          note: "已完工 / 已关闭工单回传 MES，避免重复报修。",
        },
        {
          code: "SYNC-WMS-PART-PUSH",
          name: "WMS 备件领用推送",
          endpointId: wmsEndpoint.id,
          dataset: "material_issue",
          direction: "push",
          intervalMinutes: 30,
          enabled: false,
          note: "备件出库流水推送仓储，待接口联调后启用。",
        },
      ])
      .returning();

  await db.insert(integrationMockMessages).values([
    {
      endpointId: mesEndpoint.id,
      dataset: "work_order",
      externalNo: "MES-WO-1001",
      status: "pending",
      note: "安灯触发：油温连续 10 分钟超过 55℃",
      payload: {
        assetCode: "EQ-0001",
        title: "注塑机液压油温偏高",
        description: "MES 安灯触发：油温连续 10 分钟超过 55℃，建议检查冷却水与油质。",
        priority: "high",
        type: "fault",
        source: "mock",
      },
    },
    {
      endpointId: mesEndpoint.id,
      dataset: "work_order",
      externalNo: "MES-WO-1002",
      status: "pending",
      note: "装配线气缸动作节拍异常",
      payload: {
        assetCode: "EQ-0006",
        title: "自动装配线气缸动作异常",
        description: "节拍由 12s 下降至 18s，怀疑气缸密封老化或气源压力不足。",
        priority: "medium",
        type: "fault",
        source: "mock",
      },
    },
    {
      endpointId: erpEndpoint.id,
      dataset: "asset_master",
      externalNo: "ERP-AST-0003",
      status: "pending",
      note: "ERP 将数控车床状态调整为保养中",
      payload: {
        code: "EQ-0003",
        name: "数控车床",
        category: "机加工设备",
        manufacturer: "沈阳机床",
        status: "maintenance",
        criticality: "B",
        source: "mock",
      },
    },
  ]);

  console.log("创建集成演示运行…");
  const demoTime = daysFromNow(-2);
  const demoAssets = [assetByCode["EQ-0001"], assetByCode["EQ-0002"]];
  const [demoRun] = await db
    .insert(syncRuns)
    .values({
      jobId: assetPushJob.id,
      status: "success",
      dataset: "asset_master",
      direction: "push",
      trigger: "manual",
      total: demoAssets.length,
      applied: demoAssets.length,
      skipped: 0,
      conflict: 0,
      failed: 0,
      message: `演示批次：共 ${demoAssets.length} 条设备主数据写入 Mock 对端`,
      actorId: manager.id,
      actorName: manager.name,
      startedAt: demoTime,
      finishedAt: demoTime,
    })
    .returning({ id: syncRuns.id });

  await db.insert(syncRecords).values(
    demoAssets.map((asset) => ({
      runId: demoRun.id,
      jobId: assetPushJob.id,
      idempotencyKey: `push:asset_master:ERP-MOCK:${asset.code}:${asset.updatedAt.toISOString()}`,
      attemptNo: 1,
      externalNo: asset.code,
      localEntity: "asset",
      localCode: asset.code,
      status: "created" as const,
      message: "已写入 Mock 对端",
      payload: {
        code: asset.code,
        name: asset.name,
        category: asset.category,
        status: asset.status,
        criticality: asset.criticality,
      },
      createdAt: demoTime,
    })),
  );

  await db.insert(integrationMockMessages).values(
    demoAssets.map((asset) => ({
      endpointId: erpEndpoint.id,
      dataset: "asset_master" as const,
      externalNo: asset.code,
      status: "received" as const,
      note: "推送任务写入 Mock 对端",
      payload: {
        code: asset.code,
        name: asset.name,
        status: asset.status,
        criticality: asset.criticality,
      },
      createdAt: demoTime,
    })),
  );

  await db
    .update(syncJobs)
    .set({ lastRunAt: demoTime, lastStatus: "success" })
    .where(eq(syncJobs.id, assetPushJob.id));

  console.log("种子数据完成：admin@cmms.local / admin123");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
