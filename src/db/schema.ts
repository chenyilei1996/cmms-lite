import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const assetStatusEnum = pgEnum("asset_status", [
  "in_service",
  "idle",
  "fault",
  "repairing",
  "maintenance",
  "stopped",
  "retired",
]);

export const assetLevelEnum = pgEnum("asset_level", [
  "factory",
  "workshop",
  "line",
  "machine",
  "component",
]);

export const criticalityEnum = pgEnum("criticality", ["A", "B", "C"]);

export const priorityEnum = pgEnum("priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "submitted",
  "converted",
  "cancelled",
]);

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "new",
  "assigned",
  "in_progress",
  "pending_acceptance",
  "completed",
  "closed",
  "cancelled",
]);

export const workOrderTypeEnum = pgEnum("work_order_type", [
  "fault",
  "corrective",
  "pm",
  "inspection",
  "project",
]);

export const planTypeEnum = pgEnum("plan_type", ["inspection", "maintenance"]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "done",
  "skipped",
]);

export const pmTriggerEnum = pgEnum("pm_trigger", ["time", "counter"]);

export const counterTypeEnum = pgEnum("counter_type", [
  "runtime_hours",
  "output",
  "actions",
]);

export const inspectionRunStatusEnum = pgEnum("inspection_run_status", [
  "pending",
  "in_progress",
  "done",
  "missed",
]);

export const inspectionItemStatusEnum = pgEnum("inspection_item_status", [
  "ok",
  "abnormal",
]);

export const inventoryTxnTypeEnum = pgEnum("inventory_txn_type", [
  "in",
  "out",
  "return",
  "transfer",
  "adjust",
]);

export const purchaseRequestStatusEnum = pgEnum("purchase_request_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "arrived",
  "cancelled",
]);

export const stocktakeStatusEnum = pgEnum("stocktake_status", [
  "draft",
  "counting",
  "done",
]);

export const responsibilityEnum = pgEnum("responsibility", [
  "equipment",
  "operation",
  "process",
  "vendor",
  "other",
]);

export const downtimeTypeEnum = pgEnum("downtime_type", [
  "unplanned",
  "planned",
]);

export const pdmMetricEnum = pgEnum("pdm_metric", [
  "vibration",
  "temperature",
  "current",
  "oil",
  "other",
]);

export const pdmRuleModeEnum = pgEnum("pdm_rule_mode", [
  "threshold",
  "duration",
  "slope",
  "combined",
]);

export const pdmDirectionEnum = pgEnum("pdm_direction", ["above", "below"]);

export const pdmSeverityEnum = pgEnum("pdm_severity", [
  "info",
  "warning",
  "critical",
]);

export const pdmAlarmStatusEnum = pgEnum("pdm_alarm_status", [
  "open",
  "acknowledged",
  "converted",
  "dismissed",
]);

export const pdmSuggestionStatusEnum = pgEnum("pdm_suggestion_status", [
  "pending",
  "converted",
  "dismissed",
]);

export const kbCategoryEnum = pgEnum("kb_category", [
  "fault_case",
  "repair_plan",
  "operation",
  "safety",
  "part_alternative",
]);

export const kbStatusEnum = pgEnum("kb_status", [
  "draft",
  "published",
  "archived",
]);

export const integrationSystemEnum = pgEnum("integration_system", [
  "mes",
  "erp",
  "wms",
  "iot",
]);

export const integrationDirectionEnum = pgEnum("integration_direction", [
  "push",
  "pull",
]);

export const syncDatasetEnum = pgEnum("sync_dataset", [
  "asset_master",
  "work_order",
  "material_issue",
  "downtime",
]);

export const syncRunStatusEnum = pgEnum("sync_run_status", [
  "running",
  "success",
  "partial",
  "failed",
]);

export const syncRecordStatusEnum = pgEnum("sync_record_status", [
  "created",
  "updated",
  "skipped",
  "conflict",
  "failed",
]);

export const mockMessageStatusEnum = pgEnum("mock_message_status", [
  "pending",
  "consumed",
  "received",
]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  tone: text("tone").notNull().default("neutral"),
  builtin: boolean("builtin").notNull().default(false),
  manage: boolean("manage").notNull().default(false),
  repair: boolean("repair").notNull().default(false),
  admin: boolean("admin").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("technician"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  level: assetLevelEnum("level").notNull().default("machine"),
  parentId: uuid("parent_id").references((): AnyPgColumn => assets.id, {
    onDelete: "set null",
  }),
  locationId: uuid("location_id").references(() => locations.id),
  installLocation: text("install_location"),
  responsibleName: text("responsible_name"),
  manufacturer: text("manufacturer"),
  vendor: text("vendor"),
  model: text("model"),
  serialNo: text("serial_no"),
  status: assetStatusEnum("status").notNull().default("in_service"),
  criticality: criticalityEnum("criticality").notNull().default("B"),
  purchaseDate: timestamp("purchase_date", { withTimezone: true }),
  warrantyUntil: timestamp("warranty_until", { withTimezone: true }),
  purchaseCost: numeric("purchase_cost", { precision: 14, scale: 2 }),
  depreciationMonths: integer("depreciation_months"),
  specs: jsonb("specs").$type<Record<string, string>>(),
  photoUrl: text("photo_url"),
  qrToken: text("qr_token").notNull().unique(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assetStatusHistory = pgTable("asset_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  source: text("source").notNull().default("manual"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const repairRequests = pgTable("repair_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicToken: text("public_token").notNull().unique(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  reporterName: text("reporter_name").notNull(),
  reporterPhone: text("reporter_phone"),
  description: text("description").notNull(),
  priority: priorityEnum("priority").notNull().default("medium"),
  status: requestStatusEnum("status").notNull().default("submitted"),
  workOrderId: uuid("work_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const faultCodes = pgTable("fault_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull().default("机械"),
  phenomenon: text("phenomenon"),
  cause: text("cause"),
  countermeasure: text("countermeasure"),
  severity: criticalityEnum("severity").notNull().default("B"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  requestId: uuid("request_id").references(() => repairRequests.id),
  type: workOrderTypeEnum("type").notNull().default("fault"),
  title: text("title").notNull(),
  description: text("description"),
  status: workOrderStatusEnum("status").notNull().default("new"),
  priority: priorityEnum("priority").notNull().default("medium"),
  assigneeId: uuid("assignee_id").references(() => users.id),
  planId: uuid("plan_id"),
  routeId: uuid("route_id"),
  pointId: uuid("point_id"),
  faultCodeId: uuid("fault_code_id").references(() => faultCodes.id, {
    onDelete: "set null",
  }),
  faultCode: text("fault_code"),
  faultPhenomenon: text("fault_phenomenon"),
  faultCause: text("fault_cause"),
  countermeasure: text("countermeasure"),
  responsibility: responsibilityEnum("responsibility")
    .notNull()
    .default("equipment"),
  affectedOutput: integer("affected_output"),
  transferReason: text("transfer_reason"),
  signatureName: text("signature_name"),
  signatureAt: timestamp("signature_at", { withTimezone: true }),
  acceptedById: uuid("accepted_by_id").references(() => users.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  resolution: text("resolution"),
  downtimeMinutes: integer("downtime_minutes"),
  laborMinutes: integer("labor_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workOrderParts = pgTable("work_order_parts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  partId: uuid("part_id").references((): AnyPgColumn => spareParts.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unit: text("unit"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workOrderEvents = pgTable("work_order_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assetDocuments = pgTable("asset_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("manual"),
  version: integer("version").notNull().default(1),
  attachmentId: uuid("attachment_id").references(() => attachments.id),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ChecklistItem = {
  label: string;
  type: "check" | "number" | "text";
  required?: boolean;
};

export const inspectionTemplates = pgTable("inspection_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  items: jsonb("items").$type<ChecklistItem[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const maintenancePlans = pgTable("maintenance_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  templateId: uuid("template_id")
    .notNull()
    .references(() => inspectionTemplates.id),
  type: planTypeEnum("type").notNull().default("inspection"),
  triggerType: pmTriggerEnum("trigger_type").notNull().default("time"),
  counterType: counterTypeEnum("counter_type"),
  counterInterval: integer("counter_interval"),
  lastCounterReading: integer("last_counter_reading"),
  cycleDays: integer("cycle_days").notNull().default(30),
  nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(),
  standardMinutes: integer("standard_minutes"),
  safetyNotes: text("safety_notes"),
  requiredTools: text("required_tools"),
  lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }),
  assigneeId: uuid("assignee_id").references(() => users.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pmReadings = pgTable("pm_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").references(() => maintenancePlans.id, {
    onDelete: "cascade",
  }),
  type: counterTypeEnum("type").notNull(),
  reading: integer("reading").notNull(),
  note: text("note"),
  recordedById: uuid("recorded_by_id").references(() => users.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inspectionTasks = pgTable("inspection_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => maintenancePlans.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  templateId: uuid("template_id")
    .notNull()
    .references(() => inspectionTemplates.id),
  type: planTypeEnum("type").notNull().default("inspection"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: taskStatusEnum("status").notNull().default("pending"),
  assigneeId: uuid("assignee_id").references(() => users.id),
  result: jsonb("result").$type<Record<string, string>>(),
  note: text("note"),
  executorName: text("executor_name"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  workOrderId: uuid("work_order_id").references(() => workOrders.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inspectionRoutes = pgTable("inspection_routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  publicToken: text("public_token").notNull().unique(),
  cycleDays: integer("cycle_days").notNull().default(7),
  assigneeId: uuid("assignee_id").references(() => users.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inspectionPoints = pgTable("inspection_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id")
    .notNull()
    .references(() => inspectionRoutes.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  checkType: text("check_type").notNull().default("check"),
  standardMin: numeric("standard_min", { precision: 12, scale: 2 }),
  standardMax: numeric("standard_max", { precision: 12, scale: 2 }),
  unit: text("unit"),
  photoRequired: boolean("photo_required").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inspectionRuns = pgTable("inspection_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id")
    .notNull()
    .references(() => inspectionRoutes.id, { onDelete: "cascade" }),
  status: inspectionRunStatusEnum("status").notNull().default("pending"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  executorName: text("executor_name"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inspectionRunItems = pgTable("inspection_run_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => inspectionRuns.id, { onDelete: "cascade" }),
  pointId: uuid("point_id")
    .notNull()
    .references(() => inspectionPoints.id, { onDelete: "cascade" }),
  value: text("value"),
  status: inspectionItemStatusEnum("status").notNull().default("ok"),
  note: text("note"),
  workOrderId: uuid("work_order_id").references(() => workOrders.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  action: text("action").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  actorId: uuid("actor_id").references(() => users.id),
  actorName: text("actor_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const downtimeRecords = pgTable("downtime_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  workOrderId: uuid("work_order_id")
    .unique()
    .references(() => workOrders.id, { onDelete: "set null" }),
  faultCodeId: uuid("fault_code_id").references(() => faultCodes.id, {
    onDelete: "set null",
  }),
  type: downtimeTypeEnum("type").notNull().default("unplanned"),
  responsibility: responsibilityEnum("responsibility")
    .notNull()
    .default("equipment"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  minutes: integer("minutes").notNull().default(0),
  affectedOutput: integer("affected_output"),
  note: text("note"),
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address"),
  managerName: text("manager_name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const spareParts = pgTable("spare_parts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull().default("通用"),
  spec: text("spec"),
  unit: text("unit").notNull().default("件"),
  brand: text("brand"),
  supplier: text("supplier"),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  binCode: text("bin_code"),
  qrToken: text("qr_token")
    .notNull()
    .unique()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
  safetyStock: integer("safety_stock").notNull().default(0),
  stockQty: integer("stock_qty").notNull().default(0),
  referencePrice: numeric("reference_price", { precision: 12, scale: 2 }),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const partBatches = pgTable("part_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  partId: uuid("part_id")
    .notNull()
    .references(() => spareParts.id, { onDelete: "cascade" }),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  batchNo: text("batch_no").notNull(),
  quantity: integer("quantity").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiryAt: timestamp("expiry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assetBom = pgTable("asset_bom", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  partId: uuid("part_id")
    .notNull()
    .references(() => spareParts.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  partId: uuid("part_id")
    .notNull()
    .references(() => spareParts.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id").references(() => partBatches.id, {
    onDelete: "set null",
  }),
  type: inventoryTxnTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
  toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, {
    onDelete: "set null",
  }),
  assetId: uuid("asset_id").references(() => assets.id),
  operatorId: uuid("operator_id").references(() => users.id),
  operatorName: text("operator_name"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const purchaseRequests = pgTable("purchase_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  status: purchaseRequestStatusEnum("status").notNull().default("draft"),
  requestedById: uuid("requested_by_id").references(() => users.id),
  approvedById: uuid("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  neededAt: timestamp("needed_at", { withTimezone: true }),
  note: text("note"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const purchaseRequestItems = pgTable("purchase_request_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => purchaseRequests.id, { onDelete: "cascade" }),
  partId: uuid("part_id")
    .notNull()
    .references(() => spareParts.id),
  quantity: integer("quantity").notNull().default(1),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stocktakes = pgTable("stocktakes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  status: stocktakeStatusEnum("status").notNull().default("draft"),
  createdById: uuid("created_by_id").references(() => users.id),
  note: text("note"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stocktakeItems = pgTable("stocktake_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  stocktakeId: uuid("stocktake_id")
    .notNull()
    .references(() => stocktakes.id, { onDelete: "cascade" }),
  partId: uuid("part_id")
    .notNull()
    .references(() => spareParts.id),
  systemQty: integer("system_qty").notNull().default(0),
  countedQty: integer("counted_qty"),
  diff: integer("diff"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pdmSensors = pgTable("pdm_sensors", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  metric: pdmMetricEnum("metric").notNull().default("other"),
  unit: text("unit").notNull().default(""),
  installLocation: text("install_location"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pdmReadings = pgTable("pdm_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sensorId: uuid("sensor_id")
    .notNull()
    .references(() => pdmSensors.id, { onDelete: "cascade" }),
  value: numeric("value", { precision: 14, scale: 3 }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pdmRules = pgTable("pdm_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  sensorId: uuid("sensor_id")
    .notNull()
    .references(() => pdmSensors.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mode: pdmRuleModeEnum("mode").notNull().default("threshold"),
  direction: pdmDirectionEnum("direction").notNull().default("above"),
  threshold: numeric("threshold", { precision: 14, scale: 3 }),
  durationMinutes: integer("duration_minutes"),
  slopePerDay: numeric("slope_per_day", { precision: 14, scale: 3 }),
  severity: pdmSeverityEnum("severity").notNull().default("warning"),
  active: boolean("active").notNull().default(true),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pdmAlarms = pgTable("pdm_alarms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => pdmRules.id, { onDelete: "cascade" }),
  sensorId: uuid("sensor_id")
    .notNull()
    .references(() => pdmSensors.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  severity: pdmSeverityEnum("severity").notNull().default("warning"),
  status: pdmAlarmStatusEnum("status").notNull().default("open"),
  value: numeric("value", { precision: 14, scale: 3 }),
  threshold: numeric("threshold", { precision: 14, scale: 3 }),
  message: text("message"),
  occurrences: integer("occurrences").notNull().default(1),
  triggeredAt: timestamp("triggered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  acknowledgedById: uuid("acknowledged_by_id").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pdmSuggestedWorkOrders = pgTable("pdm_suggested_work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  alarmId: uuid("alarm_id").references(() => pdmAlarms.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  priority: priorityEnum("priority").notNull().default("medium"),
  status: pdmSuggestionStatusEnum("status").notNull().default("pending"),
  convertedWorkOrderId: uuid("converted_work_order_id").references(
    () => workOrders.id,
    { onDelete: "set null" },
  ),
  createdById: uuid("created_by_id").references(() => users.id),
  note: text("note"),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const kbArticles = pgTable("kb_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  category: kbCategoryEnum("category").notNull().default("fault_case"),
  content: text("content").notNull(),
  assetId: uuid("asset_id").references(() => assets.id, {
    onDelete: "set null",
  }),
  assetCategory: text("asset_category"),
  faultCodeId: uuid("fault_code_id").references(() => faultCodes.id, {
    onDelete: "set null",
  }),
  tags: text("tags").notNull().default(""),
  status: kbStatusEnum("status").notNull().default("draft"),
  sourceWorkOrderId: uuid("source_work_order_id").references(
    () => workOrders.id,
    { onDelete: "set null" },
  ),
  authorId: uuid("author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  authorName: text("author_name"),
  views: integer("views").notNull().default(0),
  helpfulCount: integer("helpful_count").notNull().default(0),
  unhelpfulCount: integer("unhelpful_count").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const kbArticleVotes = pgTable("kb_article_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => kbArticles.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  helpful: boolean("helpful").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const integrationEndpoints = pgTable("integration_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  system: integrationSystemEnum("system").notNull().default("mes"),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull().default("token"),
  token: text("token"),
  mock: boolean("mock").notNull().default(true),
  enabled: boolean("enabled").notNull().default(true),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const syncJobs = pgTable("sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  endpointId: uuid("endpoint_id")
    .notNull()
    .references(() => integrationEndpoints.id, { onDelete: "cascade" }),
  dataset: syncDatasetEnum("dataset").notNull().default("asset_master"),
  direction: integrationDirectionEnum("direction").notNull().default("push"),
  enabled: boolean("enabled").notNull().default(true),
  intervalMinutes: integer("interval_minutes").notNull().default(30),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: syncRunStatusEnum("last_status"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => syncJobs.id, { onDelete: "cascade" }),
  status: syncRunStatusEnum("status").notNull().default("running"),
  dataset: syncDatasetEnum("dataset").notNull(),
  direction: integrationDirectionEnum("direction").notNull(),
  trigger: text("trigger").notNull().default("manual"),
  total: integer("total").notNull().default(0),
  applied: integer("applied").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  conflict: integer("conflict").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  message: text("message"),
  actorId: uuid("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  actorName: text("actor_name"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const syncRecords = pgTable(
  "sync_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => syncRuns.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => syncJobs.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptNo: integer("attempt_no").notNull().default(1),
    externalNo: text("external_no"),
    localEntity: text("local_entity"),
    localCode: text("local_code"),
    status: syncRecordStatusEnum("status").notNull(),
    message: text("message"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sync_records_key_attempt_idx").on(
      table.idempotencyKey,
      table.attemptNo,
    ),
  ],
);

export const integrationMockMessages = pgTable("integration_mock_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpointId: uuid("endpoint_id")
    .notNull()
    .references(() => integrationEndpoints.id, { onDelete: "cascade" }),
  dataset: syncDatasetEnum("dataset").notNull(),
  externalNo: text("external_no").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: mockMessageStatusEnum("status").notNull().default("pending"),
  note: text("note"),
  consumedRunId: uuid("consumed_run_id").references(() => syncRuns.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** AI 分析全局配置，单行（id 固定为 default）。API Key 以 AES-256-GCM 加密存储。 */
export const aiSettings = pgTable("ai_settings", {
  id: text("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  baseUrl: text("base_url").notNull().default("https://api.deepseek.com"),
  model: text("model").notNull().default("deepseek-chat"),
  apiKey: text("api_key"),
  /** manual：手动点击生成；auto：打开分析页自动生成（同数据指纹有缓存） */
  triggerMode: text("trigger_mode").notNull().default("manual"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedById: uuid("updated_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

export type AiFindingLevel = "high" | "medium" | "low";

export type AiAnalysisResult = {
  summary: string;
  findings: { title: string; detail: string; level: AiFindingLevel }[];
  actions: { title: string; detail: string }[];
  focus: string[];
};

/** AI 分析历史，仅保存成功生成的结果，便于回看与复盘。 */
export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").notNull().default("faults"),
    days: integer("days").notNull(),
    /** 指标指纹：同周期数据未变化时可直接复用结论 */
    fingerprint: text("fingerprint").notNull(),
    model: text("model").notNull(),
    summary: text("summary").notNull(),
    result: jsonb("result").$type<AiAnalysisResult>(),
    raw: text("raw"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    durationMs: integer("duration_ms"),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByName: text("created_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ai_analyses_scope_time_idx").on(table.scope, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type WorkOrderPart = typeof workOrderParts.$inferSelect;
export type RepairRequest = typeof repairRequests.$inferSelect;
export type InspectionTask = typeof inspectionTasks.$inferSelect;
export type MaintenancePlan = typeof maintenancePlans.$inferSelect;
export type InspectionTemplate = typeof inspectionTemplates.$inferSelect;
export type InspectionRoute = typeof inspectionRoutes.$inferSelect;
export type InspectionPoint = typeof inspectionPoints.$inferSelect;
export type InspectionRun = typeof inspectionRuns.$inferSelect;
export type AssetDocument = typeof assetDocuments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type SparePart = typeof spareParts.$inferSelect;
export type PartBatch = typeof partBatches.$inferSelect;
export type AssetBom = typeof assetBom.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type PurchaseRequestItem = typeof purchaseRequestItems.$inferSelect;
export type Stocktake = typeof stocktakes.$inferSelect;
export type StocktakeItem = typeof stocktakeItems.$inferSelect;
export type FaultCode = typeof faultCodes.$inferSelect;
export type DowntimeRecord = typeof downtimeRecords.$inferSelect;
export type PdmSensor = typeof pdmSensors.$inferSelect;
export type PdmReading = typeof pdmReadings.$inferSelect;
export type PdmRule = typeof pdmRules.$inferSelect;
export type PdmAlarm = typeof pdmAlarms.$inferSelect;
export type PdmSuggestedWorkOrder = typeof pdmSuggestedWorkOrders.$inferSelect;
export type KbArticle = typeof kbArticles.$inferSelect;
export type KbArticleVote = typeof kbArticleVotes.$inferSelect;
export type IntegrationEndpoint = typeof integrationEndpoints.$inferSelect;
export type SyncJob = typeof syncJobs.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
export type SyncRecord = typeof syncRecords.$inferSelect;
export type IntegrationMockMessage = typeof integrationMockMessages.$inferSelect;
export type AiSetting = typeof aiSettings.$inferSelect;
export type AiAnalysis = typeof aiAnalyses.$inferSelect;
