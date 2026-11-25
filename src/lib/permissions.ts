export type CapabilityLevel = "all" | "repair" | "manage" | "admin";

export type CapabilityGroup = {
  group: string;
  items: {
    label: string;
    detail: string;
    level: CapabilityLevel;
  }[];
};

/**
 * 角色能力：三档能力互相包含。
 * - repair：执行级，能接单维修、领料、点检、报警处理
 * - manage：管理级，能派工、验收、计划与库存管理、看成本报表
 * - admin：系统管理，能管理用户与角色
 * 高级别自动包含低级别能力。
 */
export type RoleCaps = {
  manage: boolean;
  repair: boolean;
  admin: boolean;
};

export const BUILTIN_ROLE_CAPS: Record<string, RoleCaps> = {
  admin: { manage: true, repair: true, admin: true },
  manager: { manage: true, repair: true, admin: false },
  technician: { manage: false, repair: true, admin: false },
  viewer: { manage: false, repair: false, admin: false },
};

export const NO_CAPS: RoleCaps = { manage: false, repair: false, admin: false };

/**
 * 角色权限矩阵，与 canManage / canRepair / isAdmin 的判定保持一致。
 * 页面只读展示，权限策略变更需同步修改服务端校验。
 */
export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    group: "基础访问",
    items: [
      { label: "查看总览与通知", detail: "设备状态、工单进度、站内通知", level: "all" },
      { label: "查看设备与一机一档", detail: "设备台账、二维码、状态履历", level: "all" },
      { label: "查看故障与报表", detail: "故障分析、KPI、预测性维护看板", level: "all" },
    ],
  },
  {
    group: "设备与工单",
    items: [
      { label: "新增 / 编辑设备", detail: "设备主档、树结构、二维码标签", level: "manage" },
      { label: "创建工单", detail: "故障报修、纠正性维修、点检异常转单", level: "repair" },
      { label: "派工 / 转派 / 验收 / 关闭", detail: "工单分诊与闭环审批", level: "manage" },
      { label: "开工 / 完工 / 电子签名", detail: "现场维修执行与结果填报", level: "repair" },
    ],
  },
  {
    group: "计划与点检",
    items: [
      { label: "维护模板与周期计划", detail: "点检 / 保养模板、计划启用停用（管理后台）", level: "manage" },
      { label: "点检路线与点位", detail: "路线、点位、标准上下限维护", level: "repair" },
      { label: "扫码点检与异常转单", detail: "免登录填报、异常自动建单", level: "all" },
    ],
  },
  {
    group: "备件与库存",
    items: [
      { label: "备件领用 / 退料", detail: "工单联动扣库存、写流水", level: "repair" },
      { label: "提交采购申请", detail: "手动新建、低库存补货、提交与撤回", level: "repair" },
      { label: "采购审批", detail: "审批通过 / 驳回并填写原因，通过后到货入库", level: "manage" },
      { label: "备件台账 / 盘点", detail: "编码维护、低库存补货、库存盘点", level: "manage" },
    ],
  },
  {
    group: "分析与预测",
    items: [
      { label: "预测测点与规则", detail: "测点、读数、阈值 / 持续 / 斜率规则", level: "manage" },
      { label: "报警确认与建议转工单", detail: "人工确认后转正式工单，不自动停机", level: "repair" },
      { label: "成本报表与导出", detail: "人工 + 备件成本、CSV 导出", level: "manage" },
    ],
  },
  {
    group: "知识沉淀",
    items: [
      { label: "检索与浏览知识", detail: "故障案例、维修方案、操作规程、安全提示", level: "all" },
      { label: "撰写 / 编辑知识", detail: "新建草稿、从工单沉淀经验、补充正文", level: "repair" },
      { label: "发布 / 归档知识", detail: "审核草稿、发布全员可见、归档过期内容", level: "manage" },
      { label: "知识评价", detail: "标记有帮助 / 没帮助，沉淀有用率", level: "all" },
    ],
  },
  {
    group: "系统集成",
    items: [
      {
        label: "查看集成状态与对账",
        detail: "端点、任务、运行批次与差异结论",
        level: "all",
      },
      {
        label: "配置端点与同步任务",
        detail: "MES / ERP 地址、令牌、Mock 开关、数据集与方向",
        level: "manage",
      },
      {
        label: "执行同步与失败重试",
        detail: "手动触发推送 / 拉取，重试冲突与失败记录",
        level: "manage",
      },
      {
        label: "Mock 对端注入",
        detail: "模拟外部工单与设备主数据报文，联调拉取链路",
        level: "manage",
      },
    ],
  },
  {
    group: "系统管理",
    items: [
      { label: "审计日志", detail: "设备状态、派工、签名、导出等留痕", level: "manage" },
      { label: "用户与权限管理", detail: "新增用户、改角色、停用、重置密码", level: "admin" },
    ],
  },
];

/**
 * 判断角色能力是否覆盖某个权限级别。
 * 高级别包含低级别：admin ⊃ manage ⊃ repair。
 */
export function roleHasLevel(caps: RoleCaps, level: CapabilityLevel) {
  if (level === "all") return true;
  if (level === "repair") return caps.repair || caps.manage || caps.admin;
  if (level === "manage") return caps.manage || caps.admin;
  return caps.admin;
}

export const CAPS_LABEL: Record<"manage" | "repair" | "admin", string> = {
  manage: "管理级",
  repair: "执行级",
  admin: "系统管理",
};

export const CAPS_HINT: Record<"manage" | "repair" | "admin", string> = {
  manage: "派工验收、设备主档、计划模板、库存与采购审批、成本报表（包含执行级）",
  repair: "接单维修、完工签名、备件领用、点检与报警转单",
  admin: "新增用户、调整角色、系统设置（包含管理级）",
};
