export type Role = string;

export type Tone = "mint" | "accent" | "honey" | "neutral" | "danger" | "ink";

export const ROLE_LABEL: Record<string, string> = {
  admin: "系统管理员",
  manager: "维修主管",
  technician: "维修工程师",
  viewer: "只读用户",
};

export const ROLE_TONE: Record<string, Tone> = {
  admin: "ink",
  manager: "accent",
  technician: "mint",
  viewer: "neutral",
};

export const ROLE_HINT: Record<string, string> = {
  admin: "全部业务权限，并可管理用户、角色与系统设置",
  manager: "负责分诊派工、验收关闭、计划与库存管理，可查看成本报表",
  technician: "接单维修、完工签名、备件领用、点检与报警处理",
  viewer: "只读查看设备、工单、报表与通知，不能修改业务数据",
};

export const ASSET_STATUS: Record<
  string,
  { label: string; tone: Tone }
> = {
  in_service: { label: "运行中", tone: "mint" },
  idle: { label: "待机", tone: "neutral" },
  fault: { label: "故障", tone: "danger" },
  repairing: { label: "维修中", tone: "accent" },
  maintenance: { label: "保养中", tone: "honey" },
  stopped: { label: "停用", tone: "neutral" },
  retired: { label: "已报废", tone: "ink" },
};

export const ASSET_LEVEL: Record<string, { label: string; tone: Tone }> = {
  factory: { label: "工厂", tone: "ink" },
  workshop: { label: "车间", tone: "neutral" },
  line: { label: "产线", tone: "honey" },
  machine: { label: "单机", tone: "mint" },
  component: { label: "部件", tone: "accent" },
};

export const ASSET_LEVEL_ORDER = [
  "factory",
  "workshop",
  "line",
  "machine",
  "component",
] as const;

export const WO_TYPE: Record<string, { label: string; tone: Tone }> = {
  fault: { label: "故障报修", tone: "danger" },
  corrective: { label: "纠正性维修", tone: "accent" },
  pm: { label: "预防性维护", tone: "mint" },
  inspection: { label: "点检异常", tone: "honey" },
  project: { label: "改造项目", tone: "neutral" },
};

export const PM_TRIGGER: Record<string, { label: string }> = {
  time: { label: "按时间" },
  counter: { label: "按运行计数" },
};

export const COUNTER_TYPE: Record<string, { label: string; unit: string }> = {
  runtime_hours: { label: "运行小时", unit: "h" },
  output: { label: "产量", unit: "件" },
  actions: { label: "动作次数", unit: "次" },
};

export const RUN_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "待执行", tone: "honey" },
  in_progress: { label: "执行中", tone: "accent" },
  done: { label: "已完成", tone: "mint" },
  missed: { label: "漏检", tone: "danger" },
};

export const REQUEST_STATUS: Record<string, { label: string; tone: Tone }> = {
  submitted: { label: "待受理", tone: "honey" },
  converted: { label: "已建单", tone: "mint" },
  cancelled: { label: "已取消", tone: "neutral" },
};

export const WO_STATUS: Record<
  string,
  { label: string; tone: Tone; short: string }
> = {
  new: { label: "新建", tone: "honey", short: "新" },
  assigned: { label: "已派工", tone: "neutral", short: "派" },
  in_progress: { label: "处理中", tone: "accent", short: "修" },
  pending_acceptance: { label: "待验收", tone: "honey", short: "验" },
  completed: { label: "已完成", tone: "mint", short: "完" },
  closed: { label: "已关闭", tone: "ink", short: "关" },
  cancelled: { label: "已取消", tone: "neutral", short: "销" },
};

export const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  low: { label: "低", tone: "neutral" },
  medium: { label: "中", tone: "mint" },
  high: { label: "高", tone: "honey" },
  urgent: { label: "紧急", tone: "danger" },
};

export const TASK_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "待执行", tone: "honey" },
  done: { label: "已完成", tone: "mint" },
  skipped: { label: "已跳过", tone: "neutral" },
};

export const PLAN_TYPE: Record<string, { label: string; tone: Tone }> = {
  inspection: { label: "巡检", tone: "mint" },
  maintenance: { label: "保养", tone: "accent" },
};

export const WO_BOARD_COLUMNS = [
  "new",
  "assigned",
  "in_progress",
  "pending_acceptance",
  "completed",
] as const;

export const WO_TRANSITIONS: Record<string, string[]> = {
  new: ["assigned", "cancelled"],
  assigned: ["in_progress", "new", "cancelled"],
  in_progress: ["pending_acceptance", "assigned", "cancelled"],
  pending_acceptance: ["completed", "in_progress"],
  completed: ["closed", "in_progress"],
  closed: [],
  cancelled: ["new"],
};

export const SPARE_PART_CATEGORIES = [
  "机械件",
  "电气件",
  "润滑油脂",
  "过滤耗材",
  "传动件",
  "密封件",
  "气动元件",
  "通用",
];

export const TXN_TYPE: Record<string, { label: string; tone: Tone }> = {
  in: { label: "入库", tone: "mint" },
  out: { label: "领用", tone: "accent" },
  return: { label: "退料", tone: "honey" },
  transfer: { label: "调拨", tone: "neutral" },
  adjust: { label: "盘点调整", tone: "ink" },
};

export const PURCHASE_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "草稿", tone: "neutral" },
  submitted: { label: "待审批", tone: "honey" },
  approved: { label: "已通过", tone: "accent" },
  rejected: { label: "已驳回", tone: "danger" },
  arrived: { label: "已到货", tone: "mint" },
  cancelled: { label: "已取消", tone: "neutral" },
};

export const STOCKTAKE_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "草稿", tone: "neutral" },
  counting: { label: "盘点中", tone: "honey" },
  done: { label: "已完成", tone: "mint" },
};

export const FAULT_CATEGORIES = [
  "机械",
  "电气",
  "液压",
  "气动",
  "控制",
  "其他",
];

export const RESPONSIBILITY: Record<
  string,
  { label: string; tone: Tone }
> = {
  equipment: { label: "设备原因", tone: "danger" },
  operation: { label: "操作原因", tone: "honey" },
  process: { label: "工艺原因", tone: "accent" },
  vendor: { label: "外委 / 供应商", tone: "neutral" },
  other: { label: "其他", tone: "neutral" },
};

export const DOWNTIME_TYPE: Record<
  string,
  { label: string; tone: Tone }
> = {
  unplanned: { label: "非计划停机", tone: "danger" },
  planned: { label: "计划停机", tone: "mint" },
};

export const CATEGORIES = [
  "注塑设备",
  "冲压设备",
  "机加工设备",
  "装配设备",
  "动力设备",
  "热处理设备",
  "标识设备",
  "包装设备",
  "检测设备",
  "其他",
];
