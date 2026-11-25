import { eq } from "drizzle-orm";

import { db } from "@/db";
import { assetStatusHistory, assets, locations } from "@/db/schema";
import { audit } from "@/lib/audit";
import { ASSET_LEVEL, ASSET_STATUS } from "@/lib/constants";
import { newToken } from "@/lib/qr";

type Actor = { id: string; name: string } | null;

export type AssetSyncSource = "csv" | "api";
export type AssetImportMode = "upsert" | "insert_only";
export type AssetImportRow = Record<string, unknown>;

export type AssetImportIssue = { line: number; code: string; message: string };

export type AssetImportResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: AssetImportIssue[];
  warnings: AssetImportIssue[];
  mode: AssetImportMode;
};

export type AssetImportOptions = {
  source: AssetSyncSource;
  actor: Actor;
  mode?: AssetImportMode;
  ip?: string | null;
};

const LEVELS = ["factory", "workshop", "line", "machine", "component"] as const;
const STATUSES = [
  "in_service",
  "idle",
  "fault",
  "repairing",
  "maintenance",
  "stopped",
  "retired",
] as const;

const MIN_DATE = new Date("1900-01-01T00:00:00.000Z");
const MAX_DATE = new Date("2100-12-31T23:59:59.999Z");

/** 表头别名：英文列名优先，同时兼容常见中文表头。 */
const FIELD_ALIASES: Record<string, string[]> = {
  code: ["code", "设备编码", "编码", "资产编码"],
  name: ["name", "设备名称", "名称", "资产名称"],
  category: ["category", "类别", "设备类别", "分类"],
  level: ["level", "层级"],
  status: ["status", "状态"],
  criticality: ["criticality", "关键等级", "重要度"],
  parentCode: ["parentcode", "parent_code", "上级编码", "上级设备编码"],
  locationCode: ["locationcode", "location_code", "位置编码", "位置"],
  installLocation: ["installlocation", "install_location", "安装位置"],
  responsibleName: ["responsiblename", "responsible_name", "责任人"],
  manufacturer: ["manufacturer", "制造商", "生产厂家"],
  vendor: ["vendor", "供应商"],
  model: ["model", "型号", "规格型号"],
  serialNo: ["serialno", "serial_no", "出厂编号", "序列号"],
  purchaseDate: ["purchasedate", "purchase_date", "购置日期"],
  warrantyUntil: ["warrantyuntil", "warranty_until", "质保到期", "保修到期"],
  purchaseCost: ["purchasecost", "purchase_cost", "购置成本", "原值"],
  depreciationMonths: ["depreciationmonths", "depreciation_months", "折旧月数"],
  specs: ["specs", "技术参数", "参数"],
  notes: ["notes", "备注"],
};

function field(row: AssetImportRow, key: keyof typeof FIELD_ALIASES) {
  const aliases = FIELD_ALIASES[key];
  for (const [rowKey, value] of Object.entries(row)) {
    if (typeof value !== "string" || value.trim() === "") continue;
    if (aliases.includes(rowKey.trim().toLowerCase())) return value.trim();
  }
  return "";
}

function pickEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  labels: Record<string, { label: string }>,
): T | null {
  if (!value) return null;
  const raw = value.trim();
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  const lower = raw.toLowerCase();
  if ((allowed as readonly string[]).includes(lower)) return lower as T;
  for (const [key, meta] of Object.entries(labels)) {
    if (meta.label === raw) return key as T;
  }
  return null;
}

function parseSpecs(value: string): Record<string, string> | null {
  if (!value) return null;
  const specs: Record<string, string> = {};
  for (const chunk of value.split(/[;\n]/)) {
    const [rawKey, ...rest] = chunk.split(/[=:：]/);
    const key = rawKey?.trim();
    const val = rest.join(":").trim();
    if (key && val) specs[key] = val;
  }
  return Object.keys(specs).length ? specs : null;
}

function parseDate(
  value: string,
  push: (message: string) => void,
): Date | null {
  if (!value) return null;
  const normalized = value.replace(/[/.]/g, "-").replace(/\s+.*$/, "");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    push(`日期「${value}」无法识别，已忽略`);
    return null;
  }
  if (date < MIN_DATE || date > MAX_DATE) {
    push(`日期「${value}」超出 1900-2100 合理范围，已忽略`);
    return null;
  }
  return date;
}

function parseCost(value: string, push: (message: string) => void): string | null {
  if (!value) return null;
  const raw = value.replace(/[,¥￥\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    push(`购置成本「${value}」不是有效数字，已忽略`);
    return null;
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) {
    push(`购置成本「${value}」超出合理范围，已忽略`);
    return null;
  }
  return raw;
}

function parseMonths(value: string, push: (message: string) => void): number | null {
  if (!value) return null;
  const raw = value.replace(/[^\d-]/g, "");
  const months = Number(raw);
  if (!raw || !Number.isFinite(months) || months < 0 || months > 1200) {
    push(`折旧月数「${value}」应为 0-1200 的整数，已忽略`);
    return null;
  }
  return Math.round(months);
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("23505")) return "设备编码重复";
  if (message.includes("23503")) return "关联的上级设备或位置不存在";
  if (message.includes("22001")) return "字段内容超长";
  return "写入失败，请检查该行数据";
}

type Prepared = {
  line: number;
  code: string;
  name: string;
  category: string;
  level: (typeof LEVELS)[number];
  status: (typeof STATUSES)[number] | null;
  criticality: "A" | "B" | "C" | null;
  parentCode: string;
  locationKey: string;
  textFields: Record<string, string | null>;
  purchaseDate: Date | null;
  warrantyUntil: Date | null;
  purchaseCost: string | null;
  depreciationMonths: number | null;
  specs: Record<string, string> | null;
};

/** 三方主数据 → 本地设备台账：按设备编码 upsert，整批事务写入。 */
export async function upsertAssetRows(
  rows: AssetImportRow[],
  options: AssetImportOptions,
): Promise<AssetImportResult> {
  const mode = options.mode ?? "upsert";
  const result: AssetImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    mode,
  };

  // 第一阶段：纯解析与校验，不写库，避免写一半才发现格式错误
  const prepared: Prepared[] = [];
  const seen = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const line = Number(row.__line ?? index + 2) || index + 2;
    const code = field(row, "code").toUpperCase();
    const name = field(row, "name");
    const category = field(row, "category");
    const warn = (message: string) =>
      result.warnings.push({ line, code, message });

    if (!code || !name || !category) {
      result.errors.push({ line, code, message: "设备编码、名称、类别为必填项" });
      continue;
    }
    const duplicatedAt = seen.get(code);
    if (duplicatedAt !== undefined) {
      result.skipped += 1;
      warn(`设备编码与第 ${duplicatedAt} 行重复，本行已跳过`);
      continue;
    }
    seen.set(code, line);

    const level = pickEnum(field(row, "level"), LEVELS, ASSET_LEVEL) ?? "machine";
    const statusRaw = field(row, "status");
    const status = statusRaw ? pickEnum(statusRaw, STATUSES, ASSET_STATUS) : null;
    if (statusRaw && !status) warn(`状态值「${statusRaw}」无法识别，已忽略`);

    const criticalityRaw = field(row, "criticality").toUpperCase();
    const criticality = ["A", "B", "C"].includes(criticalityRaw)
      ? (criticalityRaw as "A" | "B" | "C")
      : null;

    prepared.push({
      line,
      code,
      name,
      category,
      level,
      status,
      criticality,
      parentCode: field(row, "parentCode").toUpperCase(),
      locationKey: field(row, "locationCode").toUpperCase(),
      textFields: {
        installLocation: field(row, "installLocation") || null,
        responsibleName: field(row, "responsibleName") || null,
        manufacturer: field(row, "manufacturer") || null,
        vendor: field(row, "vendor") || null,
        model: field(row, "model") || null,
        serialNo: field(row, "serialNo") || null,
        notes: field(row, "notes") || null,
      },
      purchaseDate: parseDate(field(row, "purchaseDate"), warn),
      warrantyUntil: parseDate(field(row, "warrantyUntil"), warn),
      purchaseCost: parseCost(field(row, "purchaseCost"), warn),
      depreciationMonths: parseMonths(field(row, "depreciationMonths"), warn),
      specs: parseSpecs(field(row, "specs")),
    });
  }

  const [assetRows, locationRows] = await Promise.all([
    db
      .select({ id: assets.id, code: assets.code, status: assets.status })
      .from(assets),
    db.select({ id: locations.id, code: locations.code, name: locations.name }).from(locations),
  ]);

  const assetByCode = new Map(
    assetRows.map((row) => [
      row.code.toUpperCase(),
      { id: row.id, status: row.status },
    ] as const),
  );
  const locationByCode = new Map<string, string>();
  for (const row of locationRows) {
    locationByCode.set(row.code.toUpperCase(), row.id);
    if (!locationByCode.has(row.name.toUpperCase())) {
      locationByCode.set(row.name.toUpperCase(), row.id);
    }
  }

  const parentOf = new Map(prepared.map((item) => [item.code, item.parentCode]));

  await db.transaction(async (tx) => {
    for (const item of prepared) {
      let insertedId: string | null = null;
      try {
        await tx.transaction(async (sp) => {
          const locationId = item.locationKey
            ? (locationByCode.get(item.locationKey) ?? null)
            : null;
          if (item.locationKey && !locationId) {
            result.warnings.push({
              line: item.line,
              code: item.code,
              message: `未找到位置 ${item.locationKey}，已忽略位置`,
            });
          }

          const existing = assetByCode.get(item.code);
          if (existing) {
            if (mode === "insert_only") {
              result.skipped += 1;
              return;
            }

            const patch: Record<string, unknown> = {
              name: item.name,
              category: item.category,
              level: item.level,
              updatedAt: new Date(),
            };
            if (item.status) patch.status = item.status;
            if (item.criticality) patch.criticality = item.criticality;
            if (locationId) patch.locationId = locationId;
            if (item.purchaseDate) patch.purchaseDate = item.purchaseDate;
            if (item.warrantyUntil) patch.warrantyUntil = item.warrantyUntil;
            if (item.purchaseCost) patch.purchaseCost = item.purchaseCost;
            if (item.depreciationMonths !== null) {
              patch.depreciationMonths = item.depreciationMonths;
            }
            if (item.specs) patch.specs = item.specs;
            // 只更新有值字段，空值不覆盖本地已维护的数据
            for (const [key, value] of Object.entries(item.textFields)) {
              if (value) patch[key] = value;
            }

            await sp.update(assets).set(patch).where(eq(assets.id, existing.id));

            if (item.status && item.status !== existing.status) {
              await sp.insert(assetStatusHistory).values({
                assetId: existing.id,
                fromStatus: existing.status,
                toStatus: item.status,
                reason: options.source === "csv" ? "CSV 批量导入" : "三方系统同步",
                source: options.source === "csv" ? "import" : "integration",
                actorId: options.actor?.id ?? null,
              });
              assetByCode.set(item.code, { id: existing.id, status: item.status });
            }

            result.updated += 1;
            return;
          }

          const [created] = await sp
            .insert(assets)
            .values({
              code: item.code,
              name: item.name,
              category: item.category,
              level: item.level,
              parentId: null,
              locationId,
              status: item.status ?? "in_service",
              criticality: item.criticality ?? "B",
              purchaseDate: item.purchaseDate,
              warrantyUntil: item.warrantyUntil,
              purchaseCost: item.purchaseCost,
              depreciationMonths: item.depreciationMonths,
              specs: item.specs,
              ...item.textFields,
              qrToken: newToken(),
            })
            .returning({ id: assets.id });

          await sp.insert(assetStatusHistory).values({
            assetId: created.id,
            fromStatus: null,
            toStatus: item.status ?? "in_service",
            reason: options.source === "csv" ? "CSV 批量导入建档" : "三方系统同步建档",
            source: options.source === "csv" ? "import" : "integration",
            actorId: options.actor?.id ?? null,
          });

          insertedId = created.id;
          result.created += 1;
        });

        if (insertedId) {
          assetByCode.set(item.code, {
            id: insertedId,
            status: item.status ?? "in_service",
          });
        }
      } catch (error) {
        result.errors.push({
          line: item.line,
          code: item.code,
          message: friendlyError(error),
        });
      }
    }

    // 第二阶段：父子关系回填，支持同一文件里上级晚于下级出现
    for (const item of prepared) {
      if (!item.parentCode) continue;
      const self = assetByCode.get(item.code);
      if (!self) continue;
      const parent = assetByCode.get(item.parentCode);
      if (!parent) {
        result.warnings.push({
          line: item.line,
          code: item.code,
          message: `未找到上级设备 ${item.parentCode}，已忽略上级关系`,
        });
        continue;
      }
      if (parent.id === self.id) {
        result.warnings.push({
          line: item.line,
          code: item.code,
          message: "上级设备不能是自己，已忽略上级关系",
        });
        continue;
      }
      if (hasCycle(item.code, parentOf)) {
        result.warnings.push({
          line: item.line,
          code: item.code,
          message: "上级关系形成循环，已忽略",
        });
        continue;
      }
      await tx.update(assets).set({ parentId: parent.id }).where(eq(assets.id, self.id));
    }
  });

  await audit({
    entityType: "asset",
    action: options.source === "csv" ? "asset.import" : "asset.api",
    detail: {
      source: options.source,
      mode,
      total: result.total,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.slice(0, 500),
      warnings: result.warnings.slice(0, 500),
    },
    actorId: options.actor?.id ?? null,
    actorName: options.actor?.name ?? null,
    ip: options.ip ?? null,
  });

  return result;
}

function hasCycle(start: string, parentOf: Map<string, string>) {
  let current = parentOf.get(start) ?? "";
  let steps = 0;
  while (current && steps < 50) {
    if (current === start) return true;
    current = parentOf.get(current) ?? "";
    steps += 1;
  }
  return false;
}
