import { asc } from "drizzle-orm";

import { db } from "@/db";
import { roles } from "@/db/schema";
import {
  ROLE_HINT,
  ROLE_LABEL,
  ROLE_TONE,
  type Role,
  type Tone,
} from "./constants";
import {
  BUILTIN_ROLE_CAPS,
  NO_CAPS,
  type RoleCaps,
} from "./permissions";

export type RoleRow = {
  id: string;
  name: string;
  description: string;
  tone: Tone;
  builtin: boolean;
  manage: boolean;
  repair: boolean;
  admin: boolean;
  sortOrder: number;
};

export const BUILTIN_ROLES: RoleRow[] = [
  {
    id: "admin",
    name: ROLE_LABEL.admin,
    description: ROLE_HINT.admin,
    tone: ROLE_TONE.admin,
    builtin: true,
    ...BUILTIN_ROLE_CAPS.admin,
    sortOrder: 0,
  },
  {
    id: "manager",
    name: ROLE_LABEL.manager,
    description: ROLE_HINT.manager,
    tone: ROLE_TONE.manager,
    builtin: true,
    ...BUILTIN_ROLE_CAPS.manager,
    sortOrder: 1,
  },
  {
    id: "technician",
    name: ROLE_LABEL.technician,
    description: ROLE_HINT.technician,
    tone: ROLE_TONE.technician,
    builtin: true,
    ...BUILTIN_ROLE_CAPS.technician,
    sortOrder: 2,
  },
  {
    id: "viewer",
    name: ROLE_LABEL.viewer,
    description: ROLE_HINT.viewer,
    tone: ROLE_TONE.viewer,
    builtin: true,
    ...BUILTIN_ROLE_CAPS.viewer,
    sortOrder: 3,
  },
];

const TTL_MS = 10_000;

let cache: { at: number; rows: RoleRow[] } | null = null;
let inflight: Promise<RoleRow[]> | null = null;

function normalize(row: {
  id: string;
  name: string;
  description: string;
  tone: string;
  builtin: boolean;
  manage: boolean;
  repair: boolean;
  admin: boolean;
  sortOrder: number;
}): RoleRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tone: (row.tone as Tone) ?? "neutral",
    builtin: row.builtin,
    manage: row.manage,
    repair: row.repair,
    admin: row.admin,
    sortOrder: row.sortOrder,
  };
}

async function loadFromDb(): Promise<RoleRow[]> {
  try {
    const rows = await db
      .select()
      .from(roles)
      .orderBy(asc(roles.sortOrder), asc(roles.name));
    if (rows.length === 0) return BUILTIN_ROLES;
    return rows.map(normalize);
  } catch (error) {
    console.error("load roles failed, fallback to builtin", error);
    return BUILTIN_ROLES;
  }
}

/**
 * 角色表很小，用进程内缓存避免每个请求都查库。
 * 角色被修改后调用 invalidateRoles 立即失效。
 */
export async function ensureRolesLoaded(): Promise<RoleRow[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  if (inflight) return inflight;
  inflight = loadFromDb();
  try {
    const rows = await inflight;
    cache = { at: Date.now(), rows };
    return rows;
  } finally {
    inflight = null;
  }
}

export function invalidateRoles() {
  cache = null;
}

export function listRolesSync(): RoleRow[] {
  return cache?.rows ?? BUILTIN_ROLES;
}

export async function listRoles(): Promise<RoleRow[]> {
  return ensureRolesLoaded();
}

export function capsOf(role: Role): RoleCaps {
  const found = listRolesSync().find((item) => item.id === role);
  if (!found) return BUILTIN_ROLE_CAPS[role] ?? NO_CAPS;
  return { manage: found.manage, repair: found.repair, admin: found.admin };
}

export function roleRowOf(role: Role): RoleRow | null {
  return listRolesSync().find((item) => item.id === role) ?? null;
}

export function roleNameOf(role: Role): string {
  return roleRowOf(role)?.name ?? ROLE_LABEL[role] ?? role;
}

export function roleToneOf(role: Role): Tone {
  return roleRowOf(role)?.tone ?? ROLE_TONE[role] ?? "neutral";
}

export function roleHintOf(role: Role): string {
  return roleRowOf(role)?.description ?? ROLE_HINT[role] ?? "";
}
