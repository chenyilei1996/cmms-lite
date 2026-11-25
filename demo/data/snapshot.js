window.SNAPSHOT = {
  "meta": {
    "generatedAt": "2026-11-25 17:20",
    "generatedAtIso": "2026-11-25T09:20:11.650Z",
    "source": "本地真实库 cmms（PostgreSQL）",
    "dataTimestamp": "2026-11-24T12:06:00.499Z",
    "counts": {
      "assets": 18,
      "workOrders": 9,
      "spareParts": 8,
      "users": 4,
      "roles": 4,
      "kbArticles": 8,
      "pdmAlarms": 2,
      "pdmSensors": 5,
      "notifications": 8,
      "maintenancePlans": 4,
      "inspectionRuns": 2,
      "inspectionItems": 5,
      "repairRequests": 2,
      "downtimeRecords": 9
    }
  },
  "dashboard": {
    "stats": {
      "assets": 18,
      "running": 13,
      "criticalA": 5,
      "machineAssets": 10,
      "workshops": 3,
      "openWorkOrders": 8,
      "newWorkOrders": 3,
      "inProgressWorkOrders": 1,
      "overduePlans": 0,
      "dueTodayPlans": 0,
      "repairs30": 2,
      "repairsConverted": 2
    },
    "alerts": {
      "openAlarms": 1,
      "criticalAlarms": 0,
      "pendingSuggestions": 1,
      "abnormal7": 0
    },
    "assetStatus": [
      {
        "status": "in_service",
        "label": "运行中",
        "tone": "mint",
        "color": "#4b7a53",
        "count": 13
      },
      {
        "status": "idle",
        "label": "待机",
        "tone": "neutral",
        "color": "#bdb9af",
        "count": 1
      },
      {
        "status": "fault",
        "label": "故障",
        "tone": "danger",
        "color": "#d71018",
        "count": 0
      },
      {
        "status": "repairing",
        "label": "维修",
        "tone": "accent",
        "color": "#2e5a7d",
        "count": 1
      },
      {
        "status": "maintenance",
        "label": "保养",
        "tone": "honey",
        "color": "#d9a441",
        "count": 2
      },
      {
        "status": "stopped",
        "label": "停用",
        "tone": "neutral",
        "color": "#77736a",
        "count": 0
      },
      {
        "status": "retired",
        "label": "报废",
        "tone": "neutral",
        "color": "rgba(22,21,19,.4)",
        "count": 1
      }
    ],
    "workOrderProgress": [
      {
        "status": "new",
        "label": "待派工",
        "tone": "accent",
        "count": 3
      },
      {
        "status": "assigned",
        "label": "已派工",
        "tone": "accent",
        "count": 3
      },
      {
        "status": "in_progress",
        "label": "处理中",
        "tone": "danger",
        "count": 1
      },
      {
        "status": "pending_acceptance",
        "label": "待验收",
        "tone": "honey",
        "count": 1
      },
      {
        "status": "completed",
        "label": "已完成",
        "tone": "mint",
        "count": 0
      },
      {
        "status": "closed",
        "label": "已关闭",
        "tone": "mint",
        "count": 1
      },
      {
        "status": "cancelled",
        "label": "已取消",
        "tone": "neutral",
        "count": 0
      }
    ],
    "recentWorkOrders": [
      {
        "code": "MES-WO-1002",
        "title": "自动装配线气缸动作异常",
        "status": "new",
        "statusLabel": "待派工",
        "statusTone": "accent",
        "createdAt": "2026-11-25T06:04:28.673Z"
      },
      {
        "code": "MES-WO-1001",
        "title": "注塑机液压油温偏高",
        "status": "new",
        "statusLabel": "待派工",
        "statusTone": "accent",
        "createdAt": "2026-11-25T06:04:28.661Z"
      },
      {
        "code": "WO-20261125-5B2",
        "title": "huaile",
        "status": "assigned",
        "statusLabel": "已派工",
        "statusTone": "accent",
        "createdAt": "2026-11-25T00:13:29.007Z"
      },
      {
        "code": "WO-20261124-006",
        "title": "[预测] 一号注塑机 · 主轴振动 严重报警",
        "status": "assigned",
        "statusLabel": "已派工",
        "statusTone": "accent",
        "createdAt": "2026-11-24T01:00:00.000Z"
      },
      {
        "code": "WO-20261124-005",
        "title": "装配线急停按钮误触发",
        "status": "new",
        "statusLabel": "待派工",
        "statusTone": "accent",
        "createdAt": "2026-11-24T01:00:00.000Z"
      }
    ],
    "duePlans": [
      {
        "name": "注塑机日点检",
        "assetName": "一号注塑机",
        "nextDueAt": "2026-11-26T01:00:00.000Z",
        "assignee": "李师傅",
        "templateName": "注塑机日常点检"
      },
      {
        "name": "车间电气季度检查",
        "assetName": "自动装配线",
        "nextDueAt": "2026-11-30T01:00:00.000Z",
        "assignee": "李师傅",
        "templateName": "电气安全季度检查"
      },
      {
        "name": "注塑机运行 500 小时保养",
        "assetName": "一号注塑机",
        "nextDueAt": "2026-12-08T01:00:00.000Z",
        "assignee": "李师傅",
        "templateName": "注塑机日常点检"
      },
      {
        "name": "空压机月度保养",
        "assetName": "螺杆空压机",
        "nextDueAt": "2026-12-23T01:00:00.000Z",
        "assignee": "周师傅",
        "templateName": "空压机月度保养"
      }
    ]
  },
  "assets": [
    {
      "code": "COMP-0001",
      "name": "液压系统",
      "category": "部件",
      "level": "component",
      "levelLabel": "部件",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "李师傅",
      "manufacturer": "",
      "model": "",
      "installLocation": "",
      "workshop": "一号车间",
      "location": "",
      "parentCode": "EQ-0001",
      "parentName": "一号注塑机",
      "purchaseAt": null,
      "purchaseMonth": "",
      "warrantyUntil": null,
      "notes": "",
      "openWorkOrders": 1,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "COMP-0002",
      "name": "电控柜",
      "category": "部件",
      "level": "component",
      "levelLabel": "部件",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "李师傅",
      "manufacturer": "",
      "model": "",
      "installLocation": "",
      "workshop": "一号车间",
      "location": "",
      "parentCode": "EQ-0001",
      "parentName": "一号注塑机",
      "purchaseAt": null,
      "purchaseMonth": "",
      "warrantyUntil": null,
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "EQ-0001",
      "name": "一号注塑机",
      "category": "注塑设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "A",
      "owner": "李师傅",
      "manufacturer": "海天",
      "model": "MA2100",
      "installLocation": "一号车间 A 线 1 号工位",
      "workshop": "一号车间",
      "location": "一号车间",
      "parentCode": "LINE-01",
      "parentName": "A 注塑产线",
      "purchaseAt": "2021-03-11T16:00:00.000Z",
      "purchaseMonth": "2021-03",
      "warrantyUntil": "2026-03-11T16:00:00.000Z",
      "notes": "两班制运行，重点盯液压油温。",
      "openWorkOrders": 2,
      "lastCheckAt": "2026-11-24T12:06:00.518Z",
      "pdmLatest": {
        "name": "主轴振动",
        "value": 7.8,
        "unit": "mm/s"
      }
    },
    {
      "code": "EQ-0002",
      "name": "二号注塑机",
      "category": "注塑设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "repairing",
      "statusLabel": "维修",
      "statusTone": "accent",
      "criticality": "A",
      "owner": "李师傅",
      "manufacturer": "海天",
      "model": "MA1600",
      "installLocation": "一号车间 A 线 2 号工位",
      "workshop": "一号车间",
      "location": "一号车间",
      "parentCode": "LINE-01",
      "parentName": "A 注塑产线",
      "purchaseAt": "2021-03-11T16:00:00.000Z",
      "purchaseMonth": "2021-03",
      "warrantyUntil": "2026-03-11T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 1,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "EQ-0003",
      "name": "数控车床",
      "category": "机加工设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "maintenance",
      "statusLabel": "保养",
      "statusTone": "honey",
      "criticality": "B",
      "owner": "李师傅",
      "manufacturer": "沈阳机床",
      "model": "CAK4085",
      "installLocation": "",
      "workshop": "一号车间",
      "location": "一号车间",
      "parentCode": "LINE-01",
      "parentName": "A 注塑产线",
      "purchaseAt": "2022-08-04T16:00:00.000Z",
      "purchaseMonth": "2022-08",
      "warrantyUntil": "2025-08-04T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": "2026-11-24T12:06:00.518Z",
      "pdmLatest": null
    },
    {
      "code": "EQ-0004",
      "name": "高速冲床",
      "category": "冲压设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "maintenance",
      "statusLabel": "保养",
      "statusTone": "honey",
      "criticality": "A",
      "owner": "周师傅",
      "manufacturer": "扬力",
      "model": "JH21-110",
      "installLocation": "",
      "workshop": "二号车间",
      "location": "二号车间",
      "parentCode": "LINE-02",
      "parentName": "B 冲压装配线",
      "purchaseAt": "2020-11-19T16:00:00.000Z",
      "purchaseMonth": "2020-11",
      "warrantyUntil": "2025-11-19T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 1,
      "lastCheckAt": null,
      "pdmLatest": {
        "name": "机身振动",
        "value": 3.1,
        "unit": "mm/s"
      }
    },
    {
      "code": "EQ-0005",
      "name": "激光打标机",
      "category": "标识设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "C",
      "owner": "周师傅",
      "manufacturer": "大族激光",
      "model": "YLP-20",
      "installLocation": "",
      "workshop": "二号车间",
      "location": "二号车间",
      "parentCode": "LINE-02",
      "parentName": "B 冲压装配线",
      "purchaseAt": "2023-02-13T16:00:00.000Z",
      "purchaseMonth": "2023-02",
      "warrantyUntil": "2026-02-13T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "EQ-0006",
      "name": "自动装配线",
      "category": "装配设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "A",
      "owner": "周师傅",
      "manufacturer": "非标定制",
      "model": "ASM-3",
      "installLocation": "",
      "workshop": "二号车间",
      "location": "二号车间",
      "parentCode": "LINE-02",
      "parentName": "B 冲压装配线",
      "purchaseAt": "2024-05-08T16:00:00.000Z",
      "purchaseMonth": "2024-05",
      "warrantyUntil": "2027-05-08T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 2,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "EQ-0007",
      "name": "螺杆空压机",
      "category": "动力设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "A",
      "owner": "周师傅",
      "manufacturer": "阿特拉斯",
      "model": "GA37",
      "installLocation": "",
      "workshop": "动力站",
      "location": "动力站",
      "parentCode": "WS-03",
      "parentName": "动力站",
      "purchaseAt": "2018-08-31T16:00:00.000Z",
      "purchaseMonth": "2018-09",
      "warrantyUntil": "2023-08-31T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 1,
      "lastCheckAt": null,
      "pdmLatest": {
        "name": "排气温度",
        "value": 94,
        "unit": "℃"
      }
    },
    {
      "code": "EQ-0008",
      "name": "冷却塔",
      "category": "动力设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "idle",
      "statusLabel": "待机",
      "statusTone": "neutral",
      "criticality": "B",
      "owner": "周师傅",
      "manufacturer": "金日",
      "model": "JNT-200",
      "installLocation": "",
      "workshop": "动力站",
      "location": "动力站",
      "parentCode": "WS-03",
      "parentName": "动力站",
      "purchaseAt": "2017-04-21T16:00:00.000Z",
      "purchaseMonth": "2017-04",
      "warrantyUntil": "2022-04-21T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "EQ-0009",
      "name": "工业烘干炉",
      "category": "热处理设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "周师傅",
      "manufacturer": "苏州烘炉",
      "model": "HG-500",
      "installLocation": "",
      "workshop": "二号车间",
      "location": "二号车间",
      "parentCode": "LINE-02",
      "parentName": "B 冲压装配线",
      "purchaseAt": "2022-11-30T16:00:00.000Z",
      "purchaseMonth": "2022-12",
      "warrantyUntil": "2025-11-30T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "EQ-0010",
      "name": "自动包装机",
      "category": "包装设备",
      "level": "machine",
      "levelLabel": "设备",
      "status": "retired",
      "statusLabel": "报废",
      "statusTone": "neutral",
      "criticality": "C",
      "owner": "王主管",
      "manufacturer": "永创",
      "model": "YS-800",
      "installLocation": "",
      "workshop": "二号车间",
      "location": "成品仓库",
      "parentCode": "WS-02",
      "parentName": "二号车间",
      "purchaseAt": "2016-06-29T16:00:00.000Z",
      "purchaseMonth": "2016-06",
      "warrantyUntil": "2021-06-29T16:00:00.000Z",
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "FAC-01",
      "name": "月立集团总部工厂",
      "category": "工厂",
      "level": "factory",
      "levelLabel": "工厂",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "王主管",
      "manufacturer": "",
      "model": "",
      "installLocation": "",
      "workshop": "",
      "location": "",
      "parentCode": "",
      "parentName": "",
      "purchaseAt": null,
      "purchaseMonth": "",
      "warrantyUntil": null,
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "LINE-01",
      "name": "A 注塑产线",
      "category": "产线",
      "level": "line",
      "levelLabel": "产线",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "李师傅",
      "manufacturer": "",
      "model": "",
      "installLocation": "",
      "workshop": "一号车间",
      "location": "",
      "parentCode": "WS-01",
      "parentName": "一号车间",
      "purchaseAt": null,
      "purchaseMonth": "",
      "warrantyUntil": null,
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "LINE-02",
      "name": "B 冲压装配线",
      "category": "产线",
      "level": "line",
      "levelLabel": "产线",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "周师傅",
      "manufacturer": "",
      "model": "",
      "installLocation": "",
      "workshop": "二号车间",
      "location": "",
      "parentCode": "WS-02",
      "parentName": "二号车间",
      "purchaseAt": null,
      "purchaseMonth": "",
      "warrantyUntil": null,
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "WS-01",
      "name": "一号车间",
      "category": "车间",
      "level": "workshop",
      "levelLabel": "车间",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "王主管",
      "manufacturer": "",
      "model": "",
      "installLocation": "",
      "workshop": "一号车间",
      "location": "",
      "parentCode": "FAC-01",
      "parentName": "月立集团总部工厂",
      "purchaseAt": null,
      "purchaseMonth": "",
      "warrantyUntil": null,
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "WS-02",
      "name": "二号车间",
      "category": "车间",
      "level": "workshop",
      "levelLabel": "车间",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "王主管",
      "manufacturer": "",
      "model": "",
      "installLocation": "",
      "workshop": "二号车间",
      "location": "",
      "parentCode": "FAC-01",
      "parentName": "月立集团总部工厂",
      "purchaseAt": null,
      "purchaseMonth": "",
      "warrantyUntil": null,
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    },
    {
      "code": "WS-03",
      "name": "动力站",
      "category": "车间",
      "level": "workshop",
      "levelLabel": "车间",
      "status": "in_service",
      "statusLabel": "运行中",
      "statusTone": "mint",
      "criticality": "B",
      "owner": "周师傅",
      "manufacturer": "",
      "model": "",
      "installLocation": "",
      "workshop": "动力站",
      "location": "",
      "parentCode": "FAC-01",
      "parentName": "月立集团总部工厂",
      "purchaseAt": null,
      "purchaseMonth": "",
      "warrantyUntil": null,
      "notes": "",
      "openWorkOrders": 0,
      "lastCheckAt": null,
      "pdmLatest": null
    }
  ],
  "workOrders": [
    {
      "code": "MES-WO-1002",
      "type": "fault",
      "typeLabel": "故障报修",
      "title": "自动装配线气缸动作异常",
      "description": "节拍由 12s 下降至 18s，怀疑气缸密封老化或气源压力不足。",
      "status": "new",
      "statusLabel": "待派工",
      "statusTone": "accent",
      "priority": "medium",
      "priorityLabel": "中",
      "assetCode": "EQ-0006",
      "assetName": "自动装配线",
      "assignee": "",
      "faultCode": "",
      "faultName": "",
      "faultCategory": "",
      "faultPhenomenon": "",
      "faultCause": "",
      "countermeasure": "",
      "resolution": "",
      "downtimeMinutes": null,
      "laborMinutes": null,
      "createdAt": "2026-11-25T06:04:28.673Z",
      "startedAt": null,
      "completedAt": null,
      "closedAt": null,
      "dueAt": null,
      "parts": []
    },
    {
      "code": "MES-WO-1001",
      "type": "fault",
      "typeLabel": "故障报修",
      "title": "注塑机液压油温偏高",
      "description": "MES 安灯触发：油温连续 10 分钟超过 55℃，建议检查冷却水与油质。",
      "status": "new",
      "statusLabel": "待派工",
      "statusTone": "accent",
      "priority": "high",
      "priorityLabel": "高",
      "assetCode": "EQ-0001",
      "assetName": "一号注塑机",
      "assignee": "",
      "faultCode": "",
      "faultName": "",
      "faultCategory": "",
      "faultPhenomenon": "",
      "faultCause": "",
      "countermeasure": "",
      "resolution": "",
      "downtimeMinutes": null,
      "laborMinutes": null,
      "createdAt": "2026-11-25T06:04:28.661Z",
      "startedAt": null,
      "completedAt": null,
      "closedAt": null,
      "dueAt": null,
      "parts": []
    },
    {
      "code": "WO-20261125-5B2",
      "type": "fault",
      "typeLabel": "故障报修",
      "title": "huaile",
      "description": "",
      "status": "assigned",
      "statusLabel": "已派工",
      "statusTone": "accent",
      "priority": "medium",
      "priorityLabel": "中",
      "assetCode": "COMP-0001",
      "assetName": "液压系统",
      "assignee": "李师傅",
      "faultCode": "",
      "faultName": "",
      "faultCategory": "",
      "faultPhenomenon": "",
      "faultCause": "",
      "countermeasure": "",
      "resolution": "",
      "downtimeMinutes": null,
      "laborMinutes": null,
      "createdAt": "2026-11-25T00:13:29.007Z",
      "startedAt": null,
      "completedAt": null,
      "closedAt": null,
      "dueAt": null,
      "parts": []
    },
    {
      "code": "WO-20261124-006",
      "type": "corrective",
      "typeLabel": "纠正维修",
      "title": "[预测] 一号注塑机 · 主轴振动 严重报警",
      "description": "由预测性维护建议转单。主轴振动近 24h 持续高于 7.1 mm/s，需检查轴承润滑与磨损，复测振动。",
      "status": "assigned",
      "statusLabel": "已派工",
      "statusTone": "accent",
      "priority": "high",
      "priorityLabel": "高",
      "assetCode": "EQ-0001",
      "assetName": "一号注塑机",
      "assignee": "李师傅",
      "faultCode": "",
      "faultName": "",
      "faultCategory": "",
      "faultPhenomenon": "",
      "faultCause": "",
      "countermeasure": "",
      "resolution": "",
      "downtimeMinutes": null,
      "laborMinutes": null,
      "createdAt": "2026-11-24T01:00:00.000Z",
      "startedAt": null,
      "completedAt": null,
      "closedAt": null,
      "dueAt": "2026-11-25T01:00:00.000Z",
      "parts": []
    },
    {
      "code": "WO-20261124-005",
      "type": "inspection",
      "typeLabel": "点检",
      "title": "装配线急停按钮误触发",
      "description": "由点检任务转工单。急停按钮偶发误触发。",
      "status": "new",
      "statusLabel": "待派工",
      "statusTone": "accent",
      "priority": "high",
      "priorityLabel": "高",
      "assetCode": "EQ-0006",
      "assetName": "自动装配线",
      "assignee": "",
      "faultCode": "F010",
      "faultName": "安全联锁失效",
      "faultCategory": "电气",
      "faultPhenomenon": "急停按钮偶发误触发",
      "faultCause": "",
      "countermeasure": "",
      "resolution": "",
      "downtimeMinutes": null,
      "laborMinutes": null,
      "createdAt": "2026-11-24T01:00:00.000Z",
      "startedAt": null,
      "completedAt": null,
      "closedAt": null,
      "dueAt": "2026-11-27T01:00:00.000Z",
      "parts": []
    },
    {
      "code": "WO-20261124-001",
      "type": "fault",
      "typeLabel": "故障报修",
      "title": "注塑机合模异响、产品飞边",
      "description": "现场判断为哥林柱润滑不足，需检查铜套磨损。",
      "status": "in_progress",
      "statusLabel": "处理中",
      "statusTone": "danger",
      "priority": "high",
      "priorityLabel": "高",
      "assetCode": "EQ-0002",
      "assetName": "二号注塑机",
      "assignee": "李师傅",
      "faultCode": "F002",
      "faultName": "轴承 / 铜套磨损",
      "faultCategory": "机械",
      "faultPhenomenon": "合模异响、产品飞边",
      "faultCause": "哥林柱润滑不足、铜套磨损",
      "countermeasure": "补充润滑脂，检查并更换铜套",
      "resolution": "",
      "downtimeMinutes": null,
      "laborMinutes": null,
      "createdAt": "2026-11-23T01:00:00.000Z",
      "startedAt": "2026-11-23T01:00:00.000Z",
      "completedAt": null,
      "closedAt": null,
      "dueAt": "2026-11-25T01:00:00.000Z",
      "parts": [
        {
          "name": "抗磨液压油 46#",
          "qty": 1,
          "unit": "桶"
        }
      ]
    },
    {
      "code": "WO-20261124-003",
      "type": "pm",
      "typeLabel": "预防保养",
      "title": "空压机月度保养",
      "description": "按月度保养计划执行。\n检查项：空滤压差、油分桶压差、皮带张紧度、排水阀动作、运行电流",
      "status": "assigned",
      "statusLabel": "已派工",
      "statusTone": "accent",
      "priority": "medium",
      "priorityLabel": "中",
      "assetCode": "EQ-0007",
      "assetName": "螺杆空压机",
      "assignee": "周师傅",
      "faultCode": "",
      "faultName": "",
      "faultCategory": "",
      "faultPhenomenon": "",
      "faultCause": "",
      "countermeasure": "",
      "resolution": "",
      "downtimeMinutes": null,
      "laborMinutes": null,
      "createdAt": "2026-11-22T01:00:00.000Z",
      "startedAt": null,
      "completedAt": null,
      "closedAt": null,
      "dueAt": "2026-11-23T01:00:00.000Z",
      "parts": []
    },
    {
      "code": "WO-20261124-002",
      "type": "fault",
      "typeLabel": "故障报修",
      "title": "冲床离合器打滑",
      "description": "需拆检离合器摩擦片，备件已在库。",
      "status": "pending_acceptance",
      "statusLabel": "待验收",
      "statusTone": "honey",
      "priority": "urgent",
      "priorityLabel": "紧急",
      "assetCode": "EQ-0004",
      "assetName": "高速冲床",
      "assignee": "周师傅",
      "faultCode": "F007",
      "faultName": "离合器故障",
      "faultCategory": "机械",
      "faultPhenomenon": "离合器打滑、送料不到位",
      "faultCause": "摩擦片磨损超限",
      "countermeasure": "更换摩擦片并调整间隙",
      "resolution": "更换摩擦片并调整间隙，空载试机 30 分钟正常。",
      "downtimeMinutes": 185,
      "laborMinutes": 210,
      "createdAt": "2026-11-21T01:00:00.000Z",
      "startedAt": "2026-11-22T01:00:00.000Z",
      "completedAt": "2026-11-24T01:00:00.000Z",
      "closedAt": null,
      "dueAt": "2026-11-24T01:00:00.000Z",
      "parts": [
        {
          "name": "离合器摩擦片",
          "qty": 2,
          "unit": "片"
        }
      ]
    },
    {
      "code": "WO-20261124-004",
      "type": "corrective",
      "typeLabel": "纠正维修",
      "title": "打标机镜头清洁",
      "description": "日常清洁，无异常。",
      "status": "closed",
      "statusLabel": "已关闭",
      "statusTone": "mint",
      "priority": "low",
      "priorityLabel": "低",
      "assetCode": "EQ-0005",
      "assetName": "激光打标机",
      "assignee": "李师傅",
      "faultCode": "",
      "faultName": "",
      "faultCategory": "",
      "faultPhenomenon": "",
      "faultCause": "",
      "countermeasure": "",
      "resolution": "清洁镜头与振镜，打标效果恢复正常。",
      "downtimeMinutes": 15,
      "laborMinutes": 25,
      "createdAt": "2026-11-18T01:00:00.000Z",
      "startedAt": "2026-11-19T01:00:00.000Z",
      "completedAt": "2026-11-19T01:00:00.000Z",
      "closedAt": "2026-11-20T01:00:00.000Z",
      "dueAt": "2026-11-20T01:00:00.000Z",
      "parts": []
    }
  ],
  "abnormal": {
    "items": [],
    "totals": {
      "7": {
        "items": 0,
        "points": 0,
        "repeat": 0,
        "converted": 0,
        "assets": 0
      },
      "30": {
        "items": 0,
        "points": 0,
        "repeat": 0,
        "converted": 0,
        "assets": 0
      },
      "90": {
        "items": 0,
        "points": 0,
        "repeat": 0,
        "converted": 0,
        "assets": 0
      }
    },
    "runs": [
      {
        "routeName": "一号车间早班点检线",
        "status": "done",
        "executorName": "李师傅",
        "dueAt": "2026-11-23T01:00:00.000Z",
        "completedAt": "2026-11-23T01:00:00.000Z",
        "cycleDays": 1
      },
      {
        "routeName": "一号车间早班点检线",
        "status": "pending",
        "executorName": "",
        "dueAt": "2026-11-22T01:00:00.000Z",
        "completedAt": null,
        "cycleDays": 1
      }
    ]
  },
  "spareParts": {
    "parts": [
      {
        "code": "SP-0001",
        "name": "抗磨液压油 46#",
        "spec": "200L / 桶",
        "unit": "桶",
        "stockQty": 5,
        "safetyStock": 2,
        "binCode": "A-01-01",
        "supplier": "华东润滑油",
        "referencePrice": 2800,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0002",
        "name": "哥林柱铜套",
        "spec": "MA2100 专用",
        "unit": "件",
        "stockQty": 2,
        "safetyStock": 4,
        "binCode": "A-02-03",
        "supplier": "海天华南服务商",
        "referencePrice": 1200,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0003",
        "name": "离合器摩擦片",
        "spec": "JH21-110",
        "unit": "片",
        "stockQty": 4,
        "safetyStock": 6,
        "binCode": "A-02-05",
        "supplier": "扬力配件",
        "referencePrice": 380,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0004",
        "name": "空滤滤芯",
        "spec": "GA37",
        "unit": "个",
        "stockQty": 8,
        "safetyStock": 4,
        "binCode": "B-01-02",
        "supplier": "阿特拉斯服务商",
        "referencePrice": 260,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0005",
        "name": "油分滤芯",
        "spec": "GA37",
        "unit": "个",
        "stockQty": 1,
        "safetyStock": 2,
        "binCode": "B-01-03",
        "supplier": "阿特拉斯服务商",
        "referencePrice": 780,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0006",
        "name": "接近开关",
        "spec": "LJ12A3-4-Z/BX",
        "unit": "个",
        "stockQty": 16,
        "safetyStock": 10,
        "binCode": "C-01-01",
        "supplier": "工控备件商",
        "referencePrice": 45,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0007",
        "name": "传动皮带",
        "spec": "A-42",
        "unit": "条",
        "stockQty": 6,
        "safetyStock": 6,
        "binCode": "C-02-01",
        "supplier": "传动件商",
        "referencePrice": 35,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0008",
        "name": "安全门联锁开关",
        "spec": "D4NS-1AF",
        "unit": "个",
        "stockQty": 2,
        "safetyStock": 3,
        "binCode": "C-01-04",
        "supplier": "工控备件商",
        "referencePrice": 320,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      }
    ],
    "transactions": [
      {
        "type": "out",
        "quantity": 2,
        "operatorName": "周师傅",
        "note": "工单领用 WO-20261124-002",
        "partCode": "SP-0003",
        "partName": "离合器摩擦片",
        "workOrderCode": "WO-20261124-002",
        "assetName": "高速冲床",
        "createdAt": "2026-11-24T01:00:00.000Z"
      },
      {
        "type": "out",
        "quantity": 1,
        "operatorName": "李师傅",
        "note": "工单领用 WO-20261124-001",
        "partCode": "SP-0001",
        "partName": "抗磨液压油 46#",
        "workOrderCode": "WO-20261124-001",
        "assetName": "二号注塑机",
        "createdAt": "2026-11-23T01:00:00.000Z"
      },
      {
        "type": "in",
        "quantity": 4,
        "operatorName": "王主管",
        "note": "种子期初入库",
        "partCode": "SP-0003",
        "partName": "离合器摩擦片",
        "workOrderCode": "",
        "assetName": "",
        "createdAt": "2026-10-15T01:00:00.000Z"
      },
      {
        "type": "in",
        "quantity": 8,
        "operatorName": "王主管",
        "note": "种子期初入库",
        "partCode": "SP-0004",
        "partName": "空滤滤芯",
        "workOrderCode": "",
        "assetName": "",
        "createdAt": "2026-10-15T01:00:00.000Z"
      },
      {
        "type": "in",
        "quantity": 1,
        "operatorName": "王主管",
        "note": "种子期初入库",
        "partCode": "SP-0005",
        "partName": "油分滤芯",
        "workOrderCode": "",
        "assetName": "",
        "createdAt": "2026-10-15T01:00:00.000Z"
      },
      {
        "type": "in",
        "quantity": 5,
        "operatorName": "王主管",
        "note": "种子期初入库",
        "partCode": "SP-0001",
        "partName": "抗磨液压油 46#",
        "workOrderCode": "",
        "assetName": "",
        "createdAt": "2026-10-15T01:00:00.000Z"
      },
      {
        "type": "in",
        "quantity": 6,
        "operatorName": "王主管",
        "note": "种子期初入库",
        "partCode": "SP-0007",
        "partName": "传动皮带",
        "workOrderCode": "",
        "assetName": "",
        "createdAt": "2026-10-15T01:00:00.000Z"
      },
      {
        "type": "in",
        "quantity": 2,
        "operatorName": "王主管",
        "note": "种子期初入库",
        "partCode": "SP-0008",
        "partName": "安全门联锁开关",
        "workOrderCode": "",
        "assetName": "",
        "createdAt": "2026-10-15T01:00:00.000Z"
      },
      {
        "type": "in",
        "quantity": 16,
        "operatorName": "王主管",
        "note": "种子期初入库",
        "partCode": "SP-0006",
        "partName": "接近开关",
        "workOrderCode": "",
        "assetName": "",
        "createdAt": "2026-10-15T01:00:00.000Z"
      },
      {
        "type": "in",
        "quantity": 2,
        "operatorName": "王主管",
        "note": "种子期初入库",
        "partCode": "SP-0002",
        "partName": "哥林柱铜套",
        "workOrderCode": "",
        "assetName": "",
        "createdAt": "2026-10-15T01:00:00.000Z"
      }
    ],
    "lowStock": [
      {
        "code": "SP-0002",
        "name": "哥林柱铜套",
        "spec": "MA2100 专用",
        "unit": "件",
        "stockQty": 2,
        "safetyStock": 4,
        "binCode": "A-02-03",
        "supplier": "海天华南服务商",
        "referencePrice": 1200,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0003",
        "name": "离合器摩擦片",
        "spec": "JH21-110",
        "unit": "片",
        "stockQty": 4,
        "safetyStock": 6,
        "binCode": "A-02-05",
        "supplier": "扬力配件",
        "referencePrice": 380,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0005",
        "name": "油分滤芯",
        "spec": "GA37",
        "unit": "个",
        "stockQty": 1,
        "safetyStock": 2,
        "binCode": "B-01-03",
        "supplier": "阿特拉斯服务商",
        "referencePrice": 780,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      },
      {
        "code": "SP-0008",
        "name": "安全门联锁开关",
        "spec": "D4NS-1AF",
        "unit": "个",
        "stockQty": 2,
        "safetyStock": 3,
        "binCode": "C-01-04",
        "supplier": "工控备件商",
        "referencePrice": 320,
        "active": true,
        "updatedAt": "2026-11-24T12:06:00.468Z"
      }
    ],
    "stats": {
      "kinds": 8,
      "active": 8,
      "lowStock": 4,
      "outThisMonth": 3,
      "inThisMonth": 0,
      "stockValue": 22350
    }
  },
  "maintenance": {
    "plans": [
      {
        "name": "注塑机日点检",
        "type": "inspection",
        "typeLabel": "点检",
        "cycleDays": 1,
        "nextDueAt": "2026-11-26T01:00:00.000Z",
        "standardMinutes": null,
        "active": true,
        "lastCompletedAt": null,
        "assetCode": "EQ-0001",
        "assetName": "一号注塑机",
        "templateName": "注塑机日常点检",
        "assignee": "李师傅"
      },
      {
        "name": "车间电气季度检查",
        "type": "inspection",
        "typeLabel": "点检",
        "cycleDays": 90,
        "nextDueAt": "2026-11-30T01:00:00.000Z",
        "standardMinutes": null,
        "active": true,
        "lastCompletedAt": null,
        "assetCode": "EQ-0006",
        "assetName": "自动装配线",
        "templateName": "电气安全季度检查",
        "assignee": "李师傅"
      },
      {
        "name": "注塑机运行 500 小时保养",
        "type": "maintenance",
        "typeLabel": "保养",
        "cycleDays": 30,
        "nextDueAt": "2026-12-08T01:00:00.000Z",
        "standardMinutes": 90,
        "active": true,
        "lastCompletedAt": null,
        "assetCode": "EQ-0001",
        "assetName": "一号注塑机",
        "templateName": "注塑机日常点检",
        "assignee": "李师傅"
      },
      {
        "name": "空压机月度保养",
        "type": "maintenance",
        "typeLabel": "保养",
        "cycleDays": 30,
        "nextDueAt": "2026-12-23T01:00:00.000Z",
        "standardMinutes": 120,
        "active": true,
        "lastCompletedAt": null,
        "assetCode": "EQ-0007",
        "assetName": "螺杆空压机",
        "templateName": "空压机月度保养",
        "assignee": "周师傅"
      }
    ],
    "tasks": [
      {
        "type": "inspection",
        "status": "done",
        "statusLabel": "完成",
        "dueAt": "2026-11-23T01:00:00.000Z",
        "completedAt": "2026-11-23T01:00:00.000Z",
        "executorName": "李师傅",
        "note": "各项正常。",
        "assetCode": "EQ-0003",
        "assetName": "数控车床",
        "planName": "注塑机日点检",
        "templateName": "注塑机日常点检"
      },
      {
        "type": "inspection",
        "status": "pending",
        "statusLabel": "待执行",
        "dueAt": "2026-11-24T01:00:00.000Z",
        "completedAt": null,
        "executorName": "",
        "note": "",
        "assetCode": "EQ-0001",
        "assetName": "一号注塑机",
        "planName": "注塑机日点检",
        "templateName": "注塑机日常点检"
      },
      {
        "type": "inspection",
        "status": "pending",
        "statusLabel": "待执行",
        "dueAt": "2026-11-30T01:00:00.000Z",
        "completedAt": null,
        "executorName": "",
        "note": "",
        "assetCode": "EQ-0006",
        "assetName": "自动装配线",
        "planName": "车间电气季度检查",
        "templateName": "电气安全季度检查"
      }
    ],
    "stats": {
      "monthlyPlans": 2,
      "doneTasks": 1,
      "overduePlans": 0,
      "dueTodayPlans": 0
    }
  },
  "pdm": {
    "sensors": [
      {
        "code": "PDMS-01",
        "name": "主轴振动",
        "metric": "vibration",
        "unit": "mm/s",
        "installLocation": "主轴前端轴承座",
        "assetCode": "EQ-0001",
        "assetName": "一号注塑机",
        "active": true,
        "rule": {
          "name": "主轴振动持续超限",
          "mode": "duration",
          "direction": "above",
          "severity": "critical"
        },
        "threshold": 7.1,
        "standard": "≤ 7.1",
        "status": "超限",
        "exceed": true,
        "count": 13,
        "hourly": [
          {
            "t": "11-23 20:00",
            "v": 4.2,
            "n": 1
          },
          {
            "t": "11-23 22:00",
            "v": 4.4,
            "n": 1
          },
          {
            "t": "11-24 00:00",
            "v": 4.1,
            "n": 1
          },
          {
            "t": "11-24 02:00",
            "v": 4.5,
            "n": 1
          },
          {
            "t": "11-24 04:00",
            "v": 4.8,
            "n": 1
          },
          {
            "t": "11-24 06:00",
            "v": 5.1,
            "n": 1
          },
          {
            "t": "11-24 08:00",
            "v": 5.3,
            "n": 1
          },
          {
            "t": "11-24 10:00",
            "v": 6.9,
            "n": 1
          },
          {
            "t": "11-24 12:00",
            "v": 7.2,
            "n": 1
          },
          {
            "t": "11-24 14:00",
            "v": 7.4,
            "n": 1
          },
          {
            "t": "11-24 16:00",
            "v": 7.5,
            "n": 1
          },
          {
            "t": "11-24 18:00",
            "v": 7.6,
            "n": 1
          },
          {
            "t": "11-24 20:00",
            "v": 7.8,
            "n": 1
          }
        ],
        "daily": [
          {
            "t": "11-23",
            "v": 4.3,
            "n": 2
          },
          {
            "t": "11-24",
            "v": 6.2,
            "n": 11
          }
        ],
        "latest": {
          "value": 7.8,
          "at": "2026-11-24T12:06:00.499Z"
        }
      },
      {
        "code": "PDMS-02",
        "name": "液压油温",
        "metric": "temperature",
        "unit": "℃",
        "installLocation": "液压油箱回油口",
        "assetCode": "EQ-0001",
        "assetName": "一号注塑机",
        "active": true,
        "rule": {
          "name": "液压油温预警",
          "mode": "threshold",
          "direction": "above",
          "severity": "warning"
        },
        "threshold": 55,
        "standard": "≤ 55",
        "status": "超限",
        "exceed": true,
        "count": 13,
        "hourly": [
          {
            "t": "11-23 20:00",
            "v": 45,
            "n": 1
          },
          {
            "t": "11-23 22:00",
            "v": 46,
            "n": 1
          },
          {
            "t": "11-24 00:00",
            "v": 45,
            "n": 1
          },
          {
            "t": "11-24 02:00",
            "v": 47,
            "n": 1
          },
          {
            "t": "11-24 04:00",
            "v": 48,
            "n": 1
          },
          {
            "t": "11-24 06:00",
            "v": 49,
            "n": 1
          },
          {
            "t": "11-24 08:00",
            "v": 50,
            "n": 1
          },
          {
            "t": "11-24 10:00",
            "v": 52,
            "n": 1
          },
          {
            "t": "11-24 12:00",
            "v": 54,
            "n": 1
          },
          {
            "t": "11-24 14:00",
            "v": 56,
            "n": 1
          },
          {
            "t": "11-24 16:00",
            "v": 57,
            "n": 1
          },
          {
            "t": "11-24 18:00",
            "v": 58,
            "n": 1
          },
          {
            "t": "11-24 20:00",
            "v": 58.4,
            "n": 1
          }
        ],
        "daily": [
          {
            "t": "11-23",
            "v": 45.5,
            "n": 2
          },
          {
            "t": "11-24",
            "v": 52.22,
            "n": 11
          }
        ],
        "latest": {
          "value": 58.4,
          "at": "2026-11-24T12:06:00.499Z"
        }
      },
      {
        "code": "PDMS-03",
        "name": "排气温度",
        "metric": "temperature",
        "unit": "℃",
        "installLocation": "空压机排气管",
        "assetCode": "EQ-0007",
        "assetName": "螺杆空压机",
        "active": true,
        "rule": {
          "name": "排气高温组合条件",
          "mode": "combined",
          "direction": "above",
          "severity": "critical"
        },
        "threshold": 95,
        "standard": "≤ 95",
        "status": "正常",
        "exceed": false,
        "count": 13,
        "hourly": [
          {
            "t": "11-23 20:00",
            "v": 82,
            "n": 1
          },
          {
            "t": "11-23 22:00",
            "v": 83,
            "n": 1
          },
          {
            "t": "11-24 00:00",
            "v": 81,
            "n": 1
          },
          {
            "t": "11-24 02:00",
            "v": 84,
            "n": 1
          },
          {
            "t": "11-24 04:00",
            "v": 85,
            "n": 1
          },
          {
            "t": "11-24 06:00",
            "v": 86,
            "n": 1
          },
          {
            "t": "11-24 08:00",
            "v": 88,
            "n": 1
          },
          {
            "t": "11-24 10:00",
            "v": 89,
            "n": 1
          },
          {
            "t": "11-24 12:00",
            "v": 90,
            "n": 1
          },
          {
            "t": "11-24 14:00",
            "v": 91,
            "n": 1
          },
          {
            "t": "11-24 16:00",
            "v": 92,
            "n": 1
          },
          {
            "t": "11-24 18:00",
            "v": 93,
            "n": 1
          },
          {
            "t": "11-24 20:00",
            "v": 94,
            "n": 1
          }
        ],
        "daily": [
          {
            "t": "11-23",
            "v": 82.5,
            "n": 2
          },
          {
            "t": "11-24",
            "v": 88.45,
            "n": 11
          }
        ],
        "latest": {
          "value": 94,
          "at": "2026-11-24T12:06:00.499Z"
        }
      },
      {
        "code": "PDMS-04",
        "name": "主电机电流",
        "metric": "current",
        "unit": "A",
        "installLocation": "主电机配电柜",
        "assetCode": "EQ-0007",
        "assetName": "螺杆空压机",
        "active": true,
        "rule": {
          "name": "主电机电流上升趋势",
          "mode": "slope",
          "direction": "above",
          "severity": "warning"
        },
        "threshold": null,
        "standard": "—",
        "status": "正常",
        "exceed": false,
        "count": 13,
        "hourly": [
          {
            "t": "11-23 20:00",
            "v": 18,
            "n": 1
          },
          {
            "t": "11-23 22:00",
            "v": 18.5,
            "n": 1
          },
          {
            "t": "11-24 00:00",
            "v": 18.2,
            "n": 1
          },
          {
            "t": "11-24 02:00",
            "v": 18.8,
            "n": 1
          },
          {
            "t": "11-24 04:00",
            "v": 19.1,
            "n": 1
          },
          {
            "t": "11-24 06:00",
            "v": 19.4,
            "n": 1
          },
          {
            "t": "11-24 08:00",
            "v": 19.8,
            "n": 1
          },
          {
            "t": "11-24 10:00",
            "v": 20.2,
            "n": 1
          },
          {
            "t": "11-24 12:00",
            "v": 20.6,
            "n": 1
          },
          {
            "t": "11-24 14:00",
            "v": 21,
            "n": 1
          },
          {
            "t": "11-24 16:00",
            "v": 21.4,
            "n": 1
          },
          {
            "t": "11-24 18:00",
            "v": 21.8,
            "n": 1
          },
          {
            "t": "11-24 20:00",
            "v": 22.2,
            "n": 1
          }
        ],
        "daily": [
          {
            "t": "11-23",
            "v": 18.25,
            "n": 2
          },
          {
            "t": "11-24",
            "v": 20.23,
            "n": 11
          }
        ],
        "latest": {
          "value": 22.2,
          "at": "2026-11-24T12:06:00.499Z"
        }
      },
      {
        "code": "PDMS-05",
        "name": "机身振动",
        "metric": "vibration",
        "unit": "mm/s",
        "installLocation": "冲床机身地脚",
        "assetCode": "EQ-0004",
        "assetName": "高速冲床",
        "active": true,
        "rule": null,
        "threshold": null,
        "standard": "—",
        "status": "正常",
        "exceed": false,
        "count": 13,
        "hourly": [
          {
            "t": "11-23 20:00",
            "v": 3.1,
            "n": 1
          },
          {
            "t": "11-23 22:00",
            "v": 3,
            "n": 1
          },
          {
            "t": "11-24 00:00",
            "v": 3.2,
            "n": 1
          },
          {
            "t": "11-24 02:00",
            "v": 3.1,
            "n": 1
          },
          {
            "t": "11-24 04:00",
            "v": 3,
            "n": 1
          },
          {
            "t": "11-24 06:00",
            "v": 3.1,
            "n": 1
          },
          {
            "t": "11-24 08:00",
            "v": 3.2,
            "n": 1
          },
          {
            "t": "11-24 10:00",
            "v": 3,
            "n": 1
          },
          {
            "t": "11-24 12:00",
            "v": 3.1,
            "n": 1
          },
          {
            "t": "11-24 14:00",
            "v": 3.2,
            "n": 1
          },
          {
            "t": "11-24 16:00",
            "v": 3.1,
            "n": 1
          },
          {
            "t": "11-24 18:00",
            "v": 3,
            "n": 1
          },
          {
            "t": "11-24 20:00",
            "v": 3.1,
            "n": 1
          }
        ],
        "daily": [
          {
            "t": "11-23",
            "v": 3.05,
            "n": 2
          },
          {
            "t": "11-24",
            "v": 3.1,
            "n": 11
          }
        ],
        "latest": {
          "value": 3.1,
          "at": "2026-11-24T12:06:00.499Z"
        }
      }
    ],
    "alarms": [
      {
        "severity": "warning",
        "severityLabel": "预警",
        "status": "open",
        "closed": false,
        "value": 58.4,
        "threshold": 55,
        "message": "最新读数 58.4 ℃ 高于阈值 55 ℃",
        "occurrences": 4,
        "triggeredAt": "2026-11-24T04:06:00.499Z",
        "lastTriggeredAt": "2026-11-24T10:06:00.499Z",
        "sensorCode": "PDMS-02",
        "sensorName": "液压油温",
        "sensorUnit": "℃",
        "assetCode": "EQ-0001",
        "assetName": "一号注塑机",
        "ruleName": "液压油温预警"
      },
      {
        "severity": "critical",
        "severityLabel": "严重",
        "status": "converted",
        "closed": true,
        "value": 7.8,
        "threshold": 7.1,
        "message": "近 120 分钟读数持续高于 7.1 mm/s",
        "occurrences": 3,
        "triggeredAt": "2026-11-24T02:06:00.499Z",
        "lastTriggeredAt": "2026-11-24T10:06:00.499Z",
        "sensorCode": "PDMS-01",
        "sensorName": "主轴振动",
        "sensorUnit": "mm/s",
        "assetCode": "EQ-0001",
        "assetName": "一号注塑机",
        "ruleName": "主轴振动持续超限"
      }
    ],
    "suggestions": [
      {
        "code": "PSW-20261124-001",
        "title": "[预测] 一号注塑机 · 液压油温 预警报警",
        "description": "测点：PDMS-02 液压油温（℃）\n规则：液压油温预警\n报警：最新读数 58.4 ℃ 高于阈值 55 ℃\n建议：检查冷却水路、冷却器与油温传感器，确认油温回落后复测。\n来源：预测性维护建议（需人工确认后执行，不自动停机）",
        "priority": "medium",
        "status": "pending",
        "statusLabel": "待确认",
        "createdAt": "2026-11-24T10:06:00.499Z",
        "handledAt": null
      },
      {
        "code": "PSW-20261124-002",
        "title": "[预测] 一号注塑机 · 主轴振动 严重报警",
        "description": "测点：PDMS-01 主轴振动（mm/s）\n规则：主轴振动持续超限\n报警：近 120 分钟读数持续高于 7.1 mm/s\n建议：检查主轴轴承润滑与磨损，停机窗口内复测振动。\n来源：预测性维护建议（需人工确认后执行，不自动停机）",
        "priority": "high",
        "status": "converted",
        "statusLabel": "已转工单",
        "createdAt": "2026-11-24T09:06:00.499Z",
        "handledAt": "2026-11-24T11:06:00.499Z"
      }
    ],
    "rules": [
      {
        "sensor_code": "PDMS-01",
        "name": "主轴振动持续超限",
        "mode": "duration",
        "direction": "above",
        "threshold": 7.1,
        "duration_minutes": 120,
        "slope_per_day": null,
        "severity": "critical",
        "active": true
      },
      {
        "sensor_code": "PDMS-02",
        "name": "液压油温预警",
        "mode": "threshold",
        "direction": "above",
        "threshold": 55,
        "duration_minutes": null,
        "slope_per_day": null,
        "severity": "warning",
        "active": true
      },
      {
        "sensor_code": "PDMS-03",
        "name": "排气高温组合条件",
        "mode": "combined",
        "direction": "above",
        "threshold": 95,
        "duration_minutes": 120,
        "slope_per_day": null,
        "severity": "critical",
        "active": true
      },
      {
        "sensor_code": "PDMS-04",
        "name": "主电机电流上升趋势",
        "mode": "slope",
        "direction": "above",
        "threshold": null,
        "duration_minutes": null,
        "slope_per_day": 2,
        "severity": "warning",
        "active": true
      }
    ],
    "totals": {
      "sensors": 5,
      "activeRules": 4,
      "readings": 65,
      "hourlyPoints": 65,
      "dailyPoints": 10,
      "openAlarms": 1,
      "criticalAlarms": 0,
      "pendingSuggestions": 1,
      "dataTimestamp": "2026-11-24T12:06:00.499Z"
    }
  },
  "kb": {
    "categories": [
      {
        "key": "fault_case",
        "label": "故障案例",
        "count": 3
      },
      {
        "key": "repair_plan",
        "label": "维修方案",
        "count": 1
      },
      {
        "key": "operation",
        "label": "操作规程",
        "count": 2
      },
      {
        "key": "safety",
        "label": "安全提示",
        "count": 1
      },
      {
        "key": "part_alternative",
        "label": "备件替代",
        "count": 1
      }
    ],
    "articles": [
      {
        "code": "KB-0001",
        "title": "注塑机液压油温过高：从冷却水到油质的排查顺序",
        "summary": "油温持续超过 55℃ 先别急着换油，按冷却水、冷却器、油质三步排查，八成能在半小时内定位。",
        "category": "fault_case",
        "categoryLabel": "故障案例",
        "status": "published",
        "authorName": "王主管",
        "views": 46,
        "helpfulCount": 3,
        "publishedAt": "2026-11-06T01:00:00.000Z",
        "sourceWorkOrderCode": ""
      },
      {
        "code": "KB-0002",
        "title": "冲床离合器打滑更换摩擦片作业步骤",
        "summary": "从工单 WO-20261124-002 沉淀：断电上锁、拆防护罩、测量间隙、成组更换摩擦片，空载试机 30 分钟。",
        "category": "repair_plan",
        "categoryLabel": "维修方案",
        "status": "published",
        "authorName": "周师傅",
        "views": 34,
        "helpfulCount": 2,
        "publishedAt": "2026-11-12T01:00:00.000Z",
        "sourceWorkOrderCode": "WO-20261124-002"
      },
      {
        "code": "KB-0003",
        "title": "注塑机合模异响与哥林柱铜套润滑检查",
        "summary": "合模异响先查润滑，再测铜套间隙；补脂后仍有异响应安排停机检查，避免拉伤哥林柱。",
        "category": "fault_case",
        "categoryLabel": "故障案例",
        "status": "published",
        "authorName": "李师傅",
        "views": 27,
        "helpfulCount": 2,
        "publishedAt": "2026-11-15T01:00:00.000Z",
        "sourceWorkOrderCode": "WO-20261124-001"
      },
      {
        "code": "KB-0004",
        "title": "螺杆空压机月度保养标准作业",
        "summary": "空滤压差、油分桶压差、皮带张紧度、排水阀、运行电流五项必查，附上锁挂牌要求。",
        "category": "operation",
        "categoryLabel": "操作规程",
        "status": "published",
        "authorName": "王主管",
        "views": 52,
        "helpfulCount": 3,
        "publishedAt": "2026-10-30T01:00:00.000Z",
        "sourceWorkOrderCode": ""
      },
      {
        "code": "KB-0005",
        "title": "维修前上锁挂牌（LOTO）安全要求",
        "summary": "任何进入设备危险区域的维修都必须执行：断电、泄压、上锁、挂牌、验证零能量。",
        "category": "safety",
        "categoryLabel": "安全提示",
        "status": "published",
        "authorName": "王主管",
        "views": 71,
        "helpfulCount": 3,
        "publishedAt": "2026-10-25T01:00:00.000Z",
        "sourceWorkOrderCode": ""
      },
      {
        "code": "KB-0006",
        "title": "冲床离合器摩擦片替代与库存对照",
        "summary": "原厂摩擦片交期长时，可按尺寸与摩擦系数选替代件，但必须成组更换并重新测量间隙。",
        "category": "part_alternative",
        "categoryLabel": "备件替代",
        "status": "published",
        "authorName": "周师傅",
        "views": 18,
        "helpfulCount": 1,
        "publishedAt": "2026-11-19T01:00:00.000Z",
        "sourceWorkOrderCode": ""
      },
      {
        "code": "KB-0007",
        "title": "激光打标机镜片清洁与光路检查（草稿）",
        "summary": "打标变浅时先清洁镜片，再检查焦距与光路，避免直接调功率。",
        "category": "operation",
        "categoryLabel": "操作规程",
        "status": "draft",
        "authorName": "李师傅",
        "views": 0,
        "helpfulCount": 0,
        "publishedAt": null,
        "sourceWorkOrderCode": ""
      },
      {
        "code": "KB-0008",
        "title": "注塑机料筒温度异常排查（草稿）",
        "summary": "区分加热圈、热电偶与温控模块故障的快速判断方法。",
        "category": "fault_case",
        "categoryLabel": "故障案例",
        "status": "draft",
        "authorName": "李师傅",
        "views": 0,
        "helpfulCount": 0,
        "publishedAt": null,
        "sourceWorkOrderCode": ""
      }
    ],
    "total": 8,
    "published": 6,
    "drafts": 2
  },
  "notifications": {
    "items": [
      {
        "title": "已同步外部报修工单",
        "body": "MES 生产系统（Mock） 推送 MES-WO-1002：自动装配线气缸动作异常",
        "link": "/app/work-orders/88027cdd-af3a-4813-9152-a33fcea67f67",
        "read": false,
        "userName": "陈益磊",
        "createdAt": "2026-11-25T06:04:28.675Z"
      },
      {
        "title": "已同步外部报修工单",
        "body": "MES 生产系统（Mock） 推送 MES-WO-1002：自动装配线气缸动作异常",
        "link": "/app/work-orders/88027cdd-af3a-4813-9152-a33fcea67f67",
        "read": false,
        "userName": "王主管",
        "createdAt": "2026-11-25T06:04:28.675Z"
      },
      {
        "title": "已同步外部报修工单",
        "body": "MES 生产系统（Mock） 推送 MES-WO-1001：注塑机液压油温偏高",
        "link": "/app/work-orders/16fc38c0-91ec-4050-8b49-d7831838514f",
        "read": false,
        "userName": "陈益磊",
        "createdAt": "2026-11-25T06:04:28.666Z"
      },
      {
        "title": "已同步外部报修工单",
        "body": "MES 生产系统（Mock） 推送 MES-WO-1001：注塑机液压油温偏高",
        "link": "/app/work-orders/16fc38c0-91ec-4050-8b49-d7831838514f",
        "read": false,
        "userName": "王主管",
        "createdAt": "2026-11-25T06:04:28.664Z"
      },
      {
        "title": "工单已派给你：huaile",
        "body": "请进入工单详情接单并开始处理。",
        "link": "/app/work-orders/0fd9c02d-bd20-40f0-ae75-db860c3ab452",
        "read": false,
        "userName": "李师傅",
        "createdAt": "2026-11-25T00:13:56.637Z"
      },
      {
        "title": "PM 到期：空压机月度保养",
        "body": "预防性维护已自动生成工单，请按模板执行。",
        "link": "/work-orders/737f3889-9e5a-4680-bc89-4ee6772c7f68",
        "read": false,
        "userName": "周师傅",
        "createdAt": "2026-11-24T12:06:00.520Z"
      },
      {
        "title": "新工单：注塑机合模异响、产品飞边",
        "body": "有一张工单已派给你，请及时接单。",
        "link": "/work-orders/9c2f2d17-0c8e-4405-b7d2-32829a4ce6dc",
        "read": false,
        "userName": "李师傅",
        "createdAt": "2026-11-24T12:06:00.520Z"
      },
      {
        "title": "待验收：冲床离合器打滑",
        "body": "周师傅已提交验收，请及时确认。",
        "link": "/work-orders/726e3f42-4b9e-4453-bc73-b2a264b16f38",
        "read": true,
        "userName": "王主管",
        "createdAt": "2026-11-24T12:06:00.520Z"
      }
    ],
    "unread": 7
  },
  "users": [
    {
      "name": "王主管",
      "emailPrefix": "manager",
      "role": "manager",
      "active": true,
      "lastLoginAt": null,
      "createdAt": "2026-11-24T12:06:00.417Z"
    },
    {
      "name": "周师傅",
      "emailPrefix": "tech2",
      "role": "technician",
      "active": true,
      "lastLoginAt": null,
      "createdAt": "2026-11-24T12:06:00.417Z"
    },
    {
      "name": "李师傅",
      "emailPrefix": "tech1",
      "role": "technician",
      "active": true,
      "lastLoginAt": "2026-11-25T00:06:41.608Z",
      "createdAt": "2026-11-24T12:06:00.417Z"
    },
    {
      "name": "陈益磊",
      "emailPrefix": "admin",
      "role": "admin",
      "active": true,
      "lastLoginAt": "2026-11-25T07:47:06.160Z",
      "createdAt": "2026-11-24T12:06:00.417Z"
    }
  ],
  "roles": [
    {
      "id": "admin",
      "name": "系统管理员",
      "description": "全部业务权限，并可管理用户、角色与系统设置",
      "tone": "ink",
      "builtin": true,
      "abilities": [
        "manage",
        "repair",
        "admin"
      ]
    },
    {
      "id": "manager",
      "name": "维修主管",
      "description": "负责分诊派工、验收关闭、计划与库存管理，可查看成本报表",
      "tone": "accent",
      "builtin": true,
      "abilities": [
        "manage",
        "repair"
      ]
    },
    {
      "id": "technician",
      "name": "维修工程师",
      "description": "接单维修、完工签名、备件领用、点检与报警处理",
      "tone": "mint",
      "builtin": true,
      "abilities": [
        "repair"
      ]
    },
    {
      "id": "viewer",
      "name": "只读用户",
      "description": "只读查看设备、工单、报表与通知，不能修改业务数据",
      "tone": "neutral",
      "builtin": true,
      "abilities": []
    }
  ],
  "faults": {
    "stats": {
      "faults": 6,
      "avgDowntime": 96,
      "mttrHours": 2,
      "faultRate": 60,
      "affectedAssets": 6,
      "machineAssets": 10,
      "totalDowntime": 950
    },
    "monthlyTrend": [
      {
        "key": "2026-06",
        "label": "6月",
        "count": 0
      },
      {
        "key": "2026-07",
        "label": "7月",
        "count": 0
      },
      {
        "key": "2026-08",
        "label": "8月",
        "count": 0
      },
      {
        "key": "2026-09",
        "label": "9月",
        "count": 0
      },
      {
        "key": "2026-10",
        "label": "10月",
        "count": 0
      },
      {
        "key": "2026-11",
        "label": "11月",
        "count": 7
      }
    ],
    "typeTop": [
      {
        "name": "未分类",
        "count": 5
      },
      {
        "name": "机械",
        "count": 2
      }
    ],
    "downtimeTop": [
      {
        "assetCode": "EQ-0007",
        "assetName": "螺杆空压机",
        "minutes": 285,
        "count": 2,
        "unplanned": 1,
        "note": "空压机月度保养"
      },
      {
        "assetCode": "EQ-0004",
        "assetName": "高速冲床",
        "minutes": 185,
        "count": 1,
        "unplanned": 1,
        "note": "更换摩擦片并调整间隙"
      },
      {
        "assetCode": "EQ-0001",
        "assetName": "一号注塑机",
        "minutes": 120,
        "count": 1,
        "unplanned": 1,
        "note": "液压油管接头渗油"
      },
      {
        "assetCode": "EQ-0009",
        "assetName": "工业烘干炉",
        "minutes": 120,
        "count": 1,
        "unplanned": 0,
        "note": "冷却系统清洗"
      },
      {
        "assetCode": "EQ-0003",
        "assetName": "数控车床",
        "minutes": 90,
        "count": 1,
        "unplanned": 1,
        "note": "控制柜线路受潮跳闸"
      }
    ]
  }
};
