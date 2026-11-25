#!/usr/bin/env node
/**
 * 导出演示站数据快照：读取本地真实库（cmms），生成 app/demo/data/snapshot.js。
 * 只导出演示需要的字段，不包含密码哈希、API Key、密钥等敏感信息。
 *
 * 连接优先级：DATABASE_URL 环境变量 -> infra/.env -> docker exec psql 兜底
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");
const OUT_FILE = path.join(APP_DIR, "demo", "data", "snapshot.js");
const ENV_FILE = path.join(ROOT_DIR, "infra", ".env");

const TZ_OFFSET = 8 * 60 * 60 * 1000; // Asia/Shanghai
const shifted = (value) => new Date(new Date(value).getTime() + TZ_OFFSET);
const pad = (n) => String(n).padStart(2, "0");

function formatTime(value, mode = "datetime") {
  if (!value) return null;
  const d = shifted(value);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  if (mode === "date") return date;
  if (mode === "md") return date.slice(5);
  if (mode === "md-hm") return `${date.slice(5)} ${time}`;
  if (mode === "hm") return time;
  return `${date} ${time}`;
}

const dateKey = (value) => (value ? formatTime(value, "date") : "");
const monthKey = (value) => (value ? formatTime(value, "date").slice(0, 7) : "");

function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function connectionCandidates() {
  const list = [];
  if (process.env.DATABASE_URL) list.push(process.env.DATABASE_URL);
  const env = readEnvFile();
  if (env.DATABASE_URL) list.push(env.DATABASE_URL);
  // docker-compose.lite.yml 默认值：宿主端口 5432 映射到 cmms-lite-db
  list.push(
    `postgres://cmms:${env.CMMS_DB_PASSWORD || "cmms"}@localhost:5432/cmms`,
  );
  return [...new Set(list)];
}

function psqlQuery(sqlText) {
  const wrapped = `select coalesce(json_agg(t), '[]'::json) from (${sqlText}) t`;
  const output = execFileSync(
    "docker",
    ["exec", "cmms-lite-db", "psql", "-U", "cmms", "-d", "cmms", "-At", "-c", wrapped],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  ).trim();
  return output ? JSON.parse(output) : [];
}

async function makeQuery() {
  for (const url of connectionCandidates()) {
    const sql = postgres(url, {
      max: 1,
      connect_timeout: 4,
      onnotice: () => {},
    });
    try {
      await sql`select 1 as ok`;
      console.log(`已连接数据库：${url.replace(/:[^:@/]+@/, ":****@")}`);
      return {
        run: (text) => sql.unsafe(text),
        close: () => sql.end({ timeout: 3 }),
      };
    } catch (error) {
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  }
  console.warn("直连数据库失败，改用 docker exec psql 兜底");
  return {
    run: async (text) => psqlQuery(text),
    close: async () => {},
  };
}

const SQL = {
  assets: `
    with recursive up as (
      select id as start_id, id, parent_id, level, name from assets
      union all
      select up.start_id, p.id, p.parent_id, p.level, p.name
      from up join assets p on p.id = up.parent_id
    )
    select a.code, a.name, a.category, a.level, a.status, a.criticality,
           a.responsible_name, a.manufacturer, a.model, a.install_location,
           a.purchase_date, a.warranty_until, a.notes,
           parent.code as parent_code, parent.name as parent_name,
           loc.name as location_name,
           (select name from up where up.start_id = a.id and up.level = 'workshop' limit 1) as workshop,
           (select count(*) from work_orders w
              where w.asset_id = a.id
                and w.status not in ('completed','closed','cancelled')) as open_wo,
           (select max(i.created_at) from inspection_run_items i
              join inspection_points pt on pt.id = i.point_id
             where pt.asset_id = a.id) as last_check,
           (select r.value::float8 from pdm_readings r
              join pdm_sensors s on s.id = r.sensor_id
             where s.asset_id = a.id order by r.recorded_at desc limit 1) as pdm_value,
           (select s.unit from pdm_readings r
              join pdm_sensors s on s.id = r.sensor_id
             where s.asset_id = a.id order by r.recorded_at desc limit 1) as pdm_unit,
           (select s.name from pdm_readings r
              join pdm_sensors s on s.id = r.sensor_id
             where s.asset_id = a.id order by r.recorded_at desc limit 1) as pdm_name
    from assets a
    left join assets parent on parent.id = a.parent_id
    left join locations loc on loc.id = a.location_id
    order by a.code`,
  workOrders: `
    select wo.code, wo.type, wo.title, wo.description, wo.status, wo.priority,
           wo.fault_code, fc.name as fault_name, fc.category as fault_category,
           wo.fault_phenomenon, wo.fault_cause, wo.countermeasure, wo.resolution,
           wo.downtime_minutes, wo.labor_minutes,
           wo.created_at, wo.started_at, wo.completed_at, wo.closed_at, wo.due_at,
           a.code as asset_code, a.name as asset_name,
           u.name as assignee,
           coalesce((
             select json_agg(json_build_object('name', p.name, 'qty', p.quantity, 'unit', p.unit) order by p.created_at)
             from work_order_parts p where p.work_order_id = wo.id
           ), '[]'::json) as parts
    from work_orders wo
    join assets a on a.id = wo.asset_id
    left join users u on u.id = wo.assignee_id
    left join fault_codes fc on fc.id = wo.fault_code_id
    order by wo.created_at desc`,
  inspectionItems: `
    select run.status as run_status, run.executor_name, run.due_at, run.completed_at,
           i.value, i.status as item_status, i.note, i.created_at,
           pt.name as point_name, pt.check_type, pt.standard_min::float8 as standard_min,
           pt.standard_max::float8 as standard_max, pt.unit,
           a.code as asset_code, a.name as asset_name,
           rt.name as route_name,
           wo.code as work_order_code
    from inspection_run_items i
    join inspection_runs run on run.id = i.run_id
    join inspection_routes rt on rt.id = run.route_id
    join inspection_points pt on pt.id = i.point_id
    join assets a on a.id = pt.asset_id
    left join work_orders wo on wo.id = i.work_order_id
    order by i.created_at desc`,
  inspectionRuns: `
    select run.status, run.executor_name, run.due_at, run.completed_at, run.created_at,
           rt.name as route_name, rt.cycle_days
    from inspection_runs run
    join inspection_routes rt on rt.id = run.route_id
    order by run.created_at desc`,
  spareParts: `
    select code, name, spec, unit, stock_qty, safety_stock, bin_code, supplier,
           reference_price::float8 as reference_price, active, updated_at
    from spare_parts order by code`,
  inventoryTransactions: `
    select t.type, t.quantity, t.operator_name, t.note, t.created_at,
           p.code as part_code, p.name as part_name,
           wo.code as wo_code, a.name as asset_name
    from inventory_transactions t
    join spare_parts p on p.id = t.part_id
    left join work_orders wo on wo.id = t.work_order_id
    left join assets a on a.id = t.asset_id
    order by t.created_at desc limit 12`,
  plans: `
    select p.name, p.type, p.cycle_days, p.next_due_at, p.standard_minutes,
           p.active, p.last_completed_at,
           a.code as asset_code, a.name as asset_name,
           tpl.name as template_name,
           u.name as assignee
    from maintenance_plans p
    join assets a on a.id = p.asset_id
    join inspection_templates tpl on tpl.id = p.template_id
    left join users u on u.id = p.assignee_id
    order by p.next_due_at`,
  inspectionTasks: `
    select it.type, it.due_at, it.status, it.executor_name, it.completed_at, it.note,
           a.code as asset_code, a.name as asset_name,
           mp.name as plan_name, tpl.name as template_name
    from inspection_tasks it
    join assets a on a.id = it.asset_id
    join maintenance_plans mp on mp.id = it.plan_id
    join inspection_templates tpl on tpl.id = it.template_id
    order by it.due_at`,
  pdmSensors: `
    select s.code, s.name, s.metric, s.unit, s.install_location, s.active,
           a.code as asset_code, a.name as asset_name
    from pdm_sensors s join assets a on a.id = s.asset_id
    order by s.code`,
  pdmRules: `
    select s.code as sensor_code, r.name, r.mode, r.direction,
           r.threshold::float8 as threshold, r.duration_minutes,
           r.slope_per_day::float8 as slope_per_day, r.severity, r.active
    from pdm_rules r join pdm_sensors s on s.id = r.sensor_id
    order by s.code`,
  pdmAlarms: `
    select a.severity, a.status, a.value::float8 as value, a.threshold::float8 as threshold,
           a.message, a.occurrences, a.triggered_at, a.last_triggered_at,
           s.code as sensor_code, s.name as sensor_name, s.unit as sensor_unit,
           ast.code as asset_code, ast.name as asset_name,
           r.name as rule_name
    from pdm_alarms a
    join pdm_sensors s on s.id = a.sensor_id
    join assets ast on ast.id = a.asset_id
    join pdm_rules r on r.id = a.rule_id
    order by a.last_triggered_at desc`,
  pdmSuggestions: `
    select code, title, description, priority, status, created_at, handled_at
    from pdm_suggested_work_orders order by created_at desc`,
  pdmReadings: `
    select s.code as sensor_code, r.value::float8 as value, r.recorded_at
    from pdm_readings r join pdm_sensors s on s.id = r.sensor_id
    order by r.recorded_at`,
  kbArticles: `
    select k.code, k.title, k.summary, k.category, k.status, k.author_name,
           k.views, k.helpful_count, k.published_at, k.tags,
           wo.code as source_work_order_code
    from kb_articles k
    left join work_orders wo on wo.id = k.source_work_order_id
    order by k.code`,
  notifications: `
    select n.title, n.body, n.link, n.read_at, n.created_at, u.name as user_name
    from notifications n join users u on u.id = n.user_id
    order by n.created_at desc limit 8`,
  users: `
    select name, email, role, active, last_login_at, created_at
    from users order by created_at`,
  roles: `
    select id, name, description, tone, builtin, manage, repair, admin, sort_order
    from roles order by sort_order`,
  repairRequests: `
    select r.reporter_name, r.description, r.status, r.created_at,
           a.code as asset_code, a.name as asset_name
    from repair_requests r join assets a on a.id = r.asset_id
    order by r.created_at desc`,
  downtime: `
    select d.type, d.minutes, d.started_at, d.note,
           a.code as asset_code, a.name as asset_name
    from downtime_records d join assets a on a.id = d.asset_id
    order by d.started_at desc`,
  assetStatusHistory: `
    select h.from_status, h.to_status, h.reason, h.source, h.created_at,
           a.code as asset_code, a.name as asset_name
    from asset_status_history h join assets a on a.id = h.asset_id
    order by h.created_at desc limit 20`,
};

const ASSET_STATUS = {
  in_service: { label: "运行中", tone: "mint", color: "#4b7a53" },
  idle: { label: "待机", tone: "neutral", color: "#bdb9af" },
  fault: { label: "故障", tone: "danger", color: "#d71018" },
  repairing: { label: "维修", tone: "accent", color: "#2e5a7d" },
  maintenance: { label: "保养", tone: "honey", color: "#d9a441" },
  stopped: { label: "停用", tone: "neutral", color: "#77736a" },
  retired: { label: "报废", tone: "neutral", color: "rgba(22,21,19,.4)" },
};

const WO_STATUS = {
  new: { label: "待派工", tone: "accent" },
  assigned: { label: "已派工", tone: "accent" },
  in_progress: { label: "处理中", tone: "danger" },
  pending_acceptance: { label: "待验收", tone: "honey" },
  completed: { label: "已完成", tone: "mint" },
  closed: { label: "已关闭", tone: "mint" },
  cancelled: { label: "已取消", tone: "neutral" },
};

const WO_TYPE = { fault: "故障报修", corrective: "纠正维修", pm: "预防保养", inspection: "点检", project: "项目" };
const PRIORITY = { low: "低", medium: "中", high: "高", urgent: "紧急" };
const LEVEL = { factory: "工厂", workshop: "车间", line: "产线", machine: "设备", component: "部件" };
const KB_CATEGORY = {
  fault_case: "故障案例",
  repair_plan: "维修方案",
  operation: "操作规程",
  safety: "安全提示",
  part_alternative: "备件替代",
};

const num = (value, fallback = 0) => (value === null || value === undefined ? fallback : Number(value));
const round = (value, digits = 1) => Number(Number(value).toFixed(digits));

function summarizeSeries(readings, sensorCode) {
  const rows = readings.filter((r) => r.sensor_code === sensorCode);
  const hourly = new Map();
  const daily = new Map();
  for (const row of rows) {
    const at = shifted(row.recorded_at);
    const hourKey = at.toISOString().slice(0, 13);
    const dayKey = at.toISOString().slice(0, 10);
    const h = hourly.get(hourKey) || { sum: 0, n: 0 };
    h.sum += row.value;
    h.n += 1;
    hourly.set(hourKey, h);
    const d = daily.get(dayKey) || { sum: 0, n: 0 };
    d.sum += row.value;
    d.n += 1;
    daily.set(dayKey, d);
  }
  const toSeries = (map) =>
    [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, item]) => ({
        t: key.length === 13 ? `${key.slice(5, 10)} ${key.slice(11, 13)}:00` : key.slice(5),
        v: round(item.sum / item.n, 2),
        n: item.n,
      }));
  const latestRow = rows[rows.length - 1];
  return {
    count: rows.length,
    hourly: toSeries(hourly),
    daily: toSeries(daily),
    latest: latestRow ? { value: round(latestRow.value, 2), at: latestRow.recorded_at } : null,
  };
}

function buildFaults(workOrders, downtime, machineAssets) {
  const faultOrders = workOrders.filter((wo) => wo.type === "fault" || wo.type === "corrective");
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`, label: `${d.getUTCMonth() + 1}月`, count: 0 });
  }
  for (const wo of faultOrders) {
    const key = monthKey(wo.createdAt);
    const month = months.find((m) => m.key === key);
    if (month) month.count += 1;
  }

  const typeCounts = new Map();
  for (const wo of faultOrders) {
    const key = wo.faultCategory || "未分类";
    typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
  }
  const typeTop = [...typeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const unplanned = downtime.filter((row) => row.type === "unplanned");
  const avgDowntime = unplanned.length
    ? Math.round(unplanned.reduce((sum, row) => sum + row.minutes, 0) / unplanned.length)
    : 0;
  const laborOrders = faultOrders.filter((wo) => wo.laborMinutes !== null && wo.laborMinutes !== undefined);
  const mttrMinutes = laborOrders.length
    ? laborOrders.reduce((sum, wo) => sum + wo.laborMinutes, 0) / laborOrders.length
    : 0;
  const affectedAssets = new Set(unplanned.map((row) => row.assetCode));

  const byAsset = new Map();
  for (const row of downtime) {
    const item = byAsset.get(row.assetCode) || {
      assetCode: row.assetCode,
      assetName: row.assetName,
      minutes: 0,
      count: 0,
      unplanned: 0,
      note: row.note || "",
    };
    item.minutes += row.minutes;
    item.count += 1;
    if (row.type === "unplanned") item.unplanned += 1;
    if (row.note) item.note = row.note;
    byAsset.set(row.assetCode, item);
  }
  const downtimeTop = [...byAsset.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5);

  return {
    stats: {
      faults: unplanned.length,
      avgDowntime,
      mttrHours: round(mttrMinutes / 60, 1),
      faultRate: machineAssets.length ? Math.round((affectedAssets.size / machineAssets.length) * 100) : 0,
      affectedAssets: affectedAssets.size,
      machineAssets: machineAssets.length,
      totalDowntime: downtime.reduce((sum, row) => sum + row.minutes, 0),
    },
    monthlyTrend: months,
    typeTop,
    downtimeTop,
  };
}

async function main() {
  const db = await makeQuery();
  const rows = {};
  for (const [key, sqlText] of Object.entries(SQL)) {
    rows[key] = await db.run(sqlText);
    console.log(`  ${key}: ${rows[key].length} 行`);
  }
  await db.close();

  const assets = rows.assets.map((row) => {
    const status = ASSET_STATUS[row.status] || { label: row.status, tone: "neutral", color: "#77736a" };
    return {
      code: row.code,
      name: row.name,
      category: row.category,
      level: row.level,
      levelLabel: LEVEL[row.level] || row.level,
      status: row.status,
      statusLabel: status.label,
      statusTone: status.tone,
      criticality: row.criticality,
      owner: row.responsible_name || "",
      manufacturer: row.manufacturer || "",
      model: row.model || "",
      installLocation: row.install_location || "",
      workshop: row.workshop || row.location_name || "",
      location: row.location_name || "",
      parentCode: row.parent_code || "",
      parentName: row.parent_name || "",
      purchaseAt: row.purchase_date,
      purchaseMonth: formatTime(row.purchase_date, "date")?.slice(0, 7) || "",
      warrantyUntil: row.warranty_until,
      notes: row.notes || "",
      openWorkOrders: num(row.open_wo),
      lastCheckAt: row.last_check || null,
      pdmLatest: row.pdm_value === null || row.pdm_value === undefined
        ? null
        : { name: row.pdm_name || "", value: round(row.pdm_value, 2), unit: row.pdm_unit || "" },
    };
  });

  const workOrders = rows.workOrders.map((row) => {
    const status = WO_STATUS[row.status] || { label: row.status, tone: "neutral" };
    return {
      code: row.code,
      type: row.type,
      typeLabel: WO_TYPE[row.type] || row.type,
      title: row.title,
      description: row.description || "",
      status: row.status,
      statusLabel: status.label,
      statusTone: status.tone,
      priority: row.priority,
      priorityLabel: PRIORITY[row.priority] || row.priority,
      assetCode: row.asset_code,
      assetName: row.asset_name,
      assignee: row.assignee || "",
      faultCode: row.fault_code || "",
      faultName: row.fault_name || "",
      faultCategory: row.fault_category || "",
      faultPhenomenon: row.fault_phenomenon || "",
      faultCause: row.fault_cause || "",
      countermeasure: row.countermeasure || "",
      resolution: row.resolution || "",
      downtimeMinutes: row.downtime_minutes,
      laborMinutes: row.labor_minutes,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      closedAt: row.closed_at,
      dueAt: row.due_at,
      parts: (row.parts || []).map((part) => ({ name: part.name, qty: part.qty, unit: part.unit || "" })),
    };
  });

  const machineAssets = assets.filter((asset) => asset.level === "machine");
  const inspectionItems = rows.inspectionItems.map((row) => ({
    assetCode: row.asset_code,
    assetName: row.asset_name,
    pointName: row.point_name,
    checkType: row.check_type,
    value: row.value,
    standardMin: row.standard_min,
    standardMax: row.standard_max,
    unit: row.unit || "",
    status: row.item_status,
    note: row.note || "",
    runName: row.route_name,
    executorName: row.executor_name || "",
    runStatus: row.run_status,
    createdAt: row.created_at,
    workOrderCode: row.work_order_code || "",
  }));

  const spareParts = rows.spareParts.map((row) => ({
    code: row.code,
    name: row.name,
    spec: row.spec || "",
    unit: row.unit,
    stockQty: num(row.stock_qty),
    safetyStock: num(row.safety_stock),
    binCode: row.bin_code || "",
    supplier: row.supplier || "",
    referencePrice: row.reference_price === null ? null : num(row.reference_price),
    active: row.active,
    updatedAt: row.updated_at,
  }));

  const transactions = rows.inventoryTransactions.map((row) => ({
    type: row.type,
    quantity: num(row.quantity),
    operatorName: row.operator_name || "",
    note: row.note || "",
    partCode: row.part_code,
    partName: row.part_name,
    workOrderCode: row.wo_code || "",
    assetName: row.asset_name || "",
    createdAt: row.created_at,
  }));

  const plans = rows.plans.map((row) => ({
    name: row.name,
    type: row.type,
    typeLabel: row.type === "maintenance" ? "保养" : "点检",
    cycleDays: row.cycle_days,
    nextDueAt: row.next_due_at,
    standardMinutes: row.standard_minutes,
    active: row.active,
    lastCompletedAt: row.last_completed_at,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    templateName: row.template_name,
    assignee: row.assignee || "",
  }));

  const tasks = rows.inspectionTasks.map((row) => ({
    type: row.type,
    status: row.status,
    statusLabel: row.status === "done" ? "完成" : row.status === "skipped" ? "跳过" : "待执行",
    dueAt: row.due_at,
    completedAt: row.completed_at,
    executorName: row.executor_name || "",
    note: row.note || "",
    assetCode: row.asset_code,
    assetName: row.asset_name,
    planName: row.plan_name,
    templateName: row.template_name,
  }));

  const readings = rows.pdmReadings;
  const sensors = rows.pdmSensors.map((row) => {
    const series = summarizeSeries(readings, row.code);
    const rule = rows.pdmRules.find((item) => item.sensor_code === row.code && item.active);
    const threshold = rule && rule.threshold !== null ? rule.threshold : null;
    const latestValue = series.latest ? series.latest.value : null;
    const exceed = threshold !== null && latestValue !== null && latestValue > threshold;
    return {
      code: row.code,
      name: row.name,
      metric: row.metric,
      unit: row.unit || "",
      installLocation: row.install_location || "",
      assetCode: row.asset_code,
      assetName: row.asset_name,
      active: row.active,
      rule: rule
        ? { name: rule.name, mode: rule.mode, direction: rule.direction, severity: rule.severity }
        : null,
      threshold,
      standard: threshold === null ? "—" : rule.direction === "below" ? `≥ ${threshold}` : `≤ ${threshold}`,
      status: exceed ? "超限" : "正常",
      exceed,
      ...series,
    };
  });

  const alarms = rows.pdmAlarms.map((row) => ({
    severity: row.severity,
    severityLabel: row.severity === "critical" ? "严重" : row.severity === "warning" ? "预警" : "提示",
    status: row.status,
    closed: ["converted", "dismissed"].includes(row.status),
    value: row.value === null ? null : round(row.value, 2),
    threshold: row.threshold === null ? null : round(row.threshold, 2),
    message: row.message || "",
    occurrences: num(row.occurrences),
    triggeredAt: row.triggered_at,
    lastTriggeredAt: row.last_triggered_at,
    sensorCode: row.sensor_code,
    sensorName: row.sensor_name,
    sensorUnit: row.sensor_unit || "",
    assetCode: row.asset_code,
    assetName: row.asset_name,
    ruleName: row.rule_name,
  }));

  const suggestions = rows.pdmSuggestions.map((row) => ({
    code: row.code,
    title: row.title,
    description: row.description || "",
    priority: row.priority,
    status: row.status,
    statusLabel: row.status === "pending" ? "待确认" : row.status === "converted" ? "已转工单" : "已忽略",
    createdAt: row.created_at,
    handledAt: row.handled_at,
  }));

  const kbArticles = rows.kbArticles.map((row) => ({
    code: row.code,
    title: row.title,
    summary: row.summary || "",
    category: row.category,
    categoryLabel: KB_CATEGORY[row.category] || row.category,
    status: row.status,
    authorName: row.author_name || "",
    views: num(row.views),
    helpfulCount: num(row.helpful_count),
    publishedAt: row.published_at,
    sourceWorkOrderCode: row.source_work_order_code || "",
  }));

  const kbCategories = Object.entries(KB_CATEGORY).map(([key, label]) => ({
    key,
    label,
    count: kbArticles.filter((article) => article.category === key).length,
  }));

  const notifications = rows.notifications.map((row) => ({
    title: row.title,
    body: row.body || "",
    link: row.link || "",
    read: Boolean(row.read_at),
    userName: row.user_name,
    createdAt: row.created_at,
  }));

  const users = rows.users.map((row) => ({
    name: row.name,
    emailPrefix: row.email.split("@")[0],
    role: row.role,
    active: row.active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  }));

  const roles = rows.roles.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    tone: row.tone,
    builtin: row.builtin,
    abilities: [
      row.manage ? "manage" : null,
      row.repair ? "repair" : null,
      row.admin ? "admin" : null,
    ].filter(Boolean),
  }));

  const repairRequests = rows.repairRequests.map((row) => ({
    reporterName: row.reporter_name,
    description: row.description,
    status: row.status,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    createdAt: row.created_at,
  }));

  const downtime = rows.downtime.map((row) => ({
    type: row.type,
    minutes: num(row.minutes),
    note: row.note || "",
    assetCode: row.asset_code,
    assetName: row.asset_name,
    startedAt: row.started_at,
  }));

  const statusCounts = Object.keys(ASSET_STATUS).map((status) => ({
    status,
    ...ASSET_STATUS[status],
    count: assets.filter((asset) => asset.status === status).length,
  }));

  const woStatusCounts = Object.keys(WO_STATUS).map((status) => ({
    status,
    ...WO_STATUS[status],
    count: workOrders.filter((wo) => wo.status === status).length,
  }));

  const openWorkOrders = workOrders.filter((wo) => !["completed", "closed", "cancelled"].includes(wo.status));
  const openAlarms = alarms.filter((alarm) => !alarm.closed);
  const pendingSuggestions = suggestions.filter((item) => item.status === "pending");

  const now = new Date();
  const todayKey = dateKey(now);
  const overduePlans = plans.filter((plan) => dateKey(plan.nextDueAt) < todayKey);
  const dueTodayPlans = plans.filter((plan) => dateKey(plan.nextDueAt) === todayKey);
  const monthlyPlans = plans.filter((plan) => monthKey(plan.nextDueAt) === monthKey(now));
  const repairs30 = repairRequests.filter(
    (item) => now.getTime() - new Date(item.createdAt).getTime() <= 30 * 24 * 3600 * 1000,
  );
  const abnormalItems = inspectionItems.filter((item) => item.status === "abnormal");
  const abnormalTotals = {};
  for (const days of [7, 30, 90]) {
    const from = now.getTime() - days * 24 * 3600 * 1000;
    const items = abnormalItems.filter((item) => new Date(item.createdAt).getTime() >= from);
    const points = new Map();
    for (const item of items) {
      const key = `${item.assetCode}|${item.pointName}`;
      points.set(key, (points.get(key) || 0) + 1);
    }
    abnormalTotals[days] = {
      items: items.length,
      points: points.size,
      repeat: [...points.values()].filter((count) => count >= 2).length,
      converted: items.filter((item) => item.workOrderCode).length,
      assets: new Set(items.map((item) => item.assetCode)).size,
    };
  }

  const inStockValue = spareParts.reduce(
    (sum, part) => sum + (part.referencePrice || 0) * part.stockQty,
    0,
  );
  const nowMonth = monthKey(now);
  const outThisMonth = transactions.filter(
    (txn) => txn.type === "out" && monthKey(txn.createdAt) === nowMonth,
  );
  const inThisMonth = transactions.filter(
    (txn) => txn.type === "in" && monthKey(txn.createdAt) === nowMonth,
  );

  const lastReadingAt = readings.length
    ? readings.reduce((max, row) => (new Date(row.recorded_at) > new Date(max) ? row.recorded_at : max), readings[0].recorded_at)
    : null;

  const snapshot = {
    meta: {
      generatedAt: formatTime(now),
      generatedAtIso: now.toISOString(),
      source: "本地真实库 cmms（PostgreSQL）",
      dataTimestamp: lastReadingAt,
      counts: {
        assets: assets.length,
        workOrders: workOrders.length,
        spareParts: spareParts.length,
        users: users.length,
        roles: roles.length,
        kbArticles: kbArticles.length,
        pdmAlarms: alarms.length,
        pdmSensors: sensors.length,
        notifications: notifications.length,
        maintenancePlans: plans.length,
        inspectionRuns: rows.inspectionRuns.length,
        inspectionItems: inspectionItems.length,
        repairRequests: repairRequests.length,
        downtimeRecords: downtime.length,
      },
    },
    dashboard: {
      stats: {
        assets: assets.length,
        running: assets.filter((asset) => asset.status === "in_service").length,
        criticalA: assets.filter((asset) => asset.criticality === "A").length,
        machineAssets: machineAssets.length,
        workshops: new Set(assets.map((asset) => asset.workshop).filter(Boolean)).size,
        openWorkOrders: openWorkOrders.length,
        newWorkOrders: workOrders.filter((wo) => wo.status === "new").length,
        inProgressWorkOrders: workOrders.filter((wo) => wo.status === "in_progress").length,
        overduePlans: overduePlans.length,
        dueTodayPlans: dueTodayPlans.length,
        repairs30: repairs30.length,
        repairsConverted: repairs30.filter((item) => item.status === "converted").length,
      },
      alerts: {
        openAlarms: openAlarms.length,
        criticalAlarms: openAlarms.filter((alarm) => alarm.severity === "critical").length,
        pendingSuggestions: pendingSuggestions.length,
        abnormal7: abnormalTotals[7].items,
      },
      assetStatus: statusCounts,
      workOrderProgress: woStatusCounts,
      recentWorkOrders: workOrders.slice(0, 5).map((wo) => ({
        code: wo.code,
        title: wo.title,
        status: wo.status,
        statusLabel: wo.statusLabel,
        statusTone: wo.statusTone,
        createdAt: wo.createdAt,
      })),
      duePlans: plans.slice(0, 4).map((plan) => ({
        name: plan.name,
        assetName: plan.assetName,
        nextDueAt: plan.nextDueAt,
        assignee: plan.assignee,
        templateName: plan.templateName,
      })),
    },
    assets,
    workOrders,
    abnormal: {
      items: abnormalItems,
      totals: abnormalTotals,
      runs: rows.inspectionRuns.map((row) => ({
        routeName: row.route_name,
        status: row.status,
        executorName: row.executor_name || "",
        dueAt: row.due_at,
        completedAt: row.completed_at,
        cycleDays: row.cycle_days,
      })),
    },
    spareParts: {
      parts: spareParts,
      transactions,
      lowStock: spareParts.filter((part) => part.stockQty < part.safetyStock),
      stats: {
        kinds: spareParts.length,
        active: spareParts.filter((part) => part.active).length,
        lowStock: spareParts.filter((part) => part.stockQty < part.safetyStock).length,
        outThisMonth: outThisMonth.reduce((sum, txn) => sum + txn.quantity, 0),
        inThisMonth: inThisMonth.reduce((sum, txn) => sum + txn.quantity, 0),
        stockValue: Math.round(inStockValue),
      },
    },
    maintenance: {
      plans,
      tasks,
      stats: {
        monthlyPlans: monthlyPlans.length,
        doneTasks: tasks.filter((task) => task.status === "done").length,
        overduePlans: overduePlans.length,
        dueTodayPlans: dueTodayPlans.length,
      },
    },
    pdm: {
      sensors,
      alarms,
      suggestions,
      rules: rows.pdmRules,
      totals: {
        sensors: sensors.length,
        activeRules: rows.pdmRules.filter((rule) => rule.active).length,
        readings: readings.length,
        hourlyPoints: sensors.reduce((sum, sensor) => sum + sensor.hourly.length, 0),
        dailyPoints: sensors.reduce((sum, sensor) => sum + sensor.daily.length, 0),
        openAlarms: openAlarms.length,
        criticalAlarms: openAlarms.filter((alarm) => alarm.severity === "critical").length,
        pendingSuggestions: pendingSuggestions.length,
        dataTimestamp: lastReadingAt,
      },
    },
    kb: {
      categories: kbCategories,
      articles: kbArticles,
      total: kbArticles.length,
      published: kbArticles.filter((article) => article.status === "published").length,
      drafts: kbArticles.filter((article) => article.status === "draft").length,
    },
    notifications: {
      items: notifications,
      unread: notifications.filter((item) => !item.read).length,
    },
    users,
    roles,
    faults: buildFaults(workOrders, downtime, machineAssets),
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const json = JSON.stringify(snapshot, null, 2).replace(/<\//g, "<\\/");
  fs.writeFileSync(OUT_FILE, `window.SNAPSHOT = ${json};\n`, "utf8");
  console.log(`\n已生成 ${OUT_FILE}`);
  console.log(
    `设备 ${snapshot.meta.counts.assets} · 工单 ${snapshot.meta.counts.workOrders} · 备件 ${snapshot.meta.counts.spareParts} · 用户 ${snapshot.meta.counts.users} · 角色 ${snapshot.meta.counts.roles} · 报警 ${snapshot.meta.counts.pdmAlarms}`,
  );
}

main().catch((error) => {
  console.error("导出失败：", error);
  process.exit(1);
});
