"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { isAdmin, requireUser } from "@/lib/auth";
import type { Tone } from "@/lib/constants";
import { ensureRolesLoaded, invalidateRoles } from "@/lib/roles";

const TONES: Tone[] = ["ink", "accent", "mint", "honey", "neutral", "danger"];
const NAME_MAX = 12;
const DESC_MAX = 60;

type Caps = { manage: boolean; repair: boolean; admin: boolean };

function normalizeCaps(caps: Caps): Caps {
  if (caps.admin) return { manage: true, repair: true, admin: true };
  if (caps.manage) return { manage: true, repair: true, admin: false };
  return { manage: false, repair: caps.repair, admin: false };
}

function parseCaps(formData: FormData): Caps {
  return normalizeCaps({
    manage: formData.get("manage") === "on",
    repair: formData.get("repair") === "on",
    admin: formData.get("admin") === "on",
  });
}

function revalidateRoles() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/roles");
  revalidatePath("/admin/settings/users");
}

function fail(code: string): never {
  redirect(`/admin/settings/roles?error=${code}`);
}

/** 全库是否还有至少一个可用的系统管理能力账号。 */
async function hasActiveAdminUser(): Promise<boolean> {
  const rows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.active, true));
  const roleRows = await ensureRolesLoaded();
  const adminRoles = new Set(
    roleRows.filter((item) => item.admin).map((item) => item.id),
  );
  return rows.some((row) => adminRoles.has(row.role));
}

export async function createRole(formData: FormData) {
  const actor = await requireUser();
  if (!isAdmin(actor.role)) fail("forbidden");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const toneInput = String(formData.get("tone") ?? "neutral");
  const tone = (TONES as string[]).includes(toneInput)
    ? (toneInput as Tone)
    : "neutral";
  const caps = parseCaps(formData);

  if (!name) fail("fields");
  if (name.length > NAME_MAX || description.length > DESC_MAX) fail("fields");

  const existing = await ensureRolesLoaded();
  if (existing.some((item) => item.name === name)) fail("duplicate");

  const id = `custom_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const sortOrder =
    existing.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;

  await db.insert(roles).values({
    id,
    name,
    description,
    tone,
    builtin: false,
    ...caps,
    sortOrder,
  });

  invalidateRoles();
  await audit({
    entityType: "role",
    entityId: id,
    action: "role.create",
    detail: { name, description, tone, caps },
    actorId: actor.id,
    actorName: actor.name,
  });
  revalidateRoles();
  redirect("/admin/settings/roles?ok=created");
}

export async function saveRole(formData: FormData) {
  const actor = await requireUser();
  if (!isAdmin(actor.role)) fail("forbidden");

  const id = String(formData.get("id") ?? "");
  if (!id) fail("missing");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const toneInput = String(formData.get("tone") ?? "neutral");
  const tone = (TONES as string[]).includes(toneInput)
    ? (toneInput as Tone)
    : "neutral";
  let caps = parseCaps(formData);

  if (!name) fail("fields");
  if (name.length > NAME_MAX || description.length > DESC_MAX) fail("fields");

  const current = (await ensureRolesLoaded()).find((item) => item.id === id);
  if (!current) fail("missing");

  // 内置系统管理员必须保留系统管理能力，避免把唯一的超管角色降权。
  if (id === "admin") caps = { manage: true, repair: true, admin: true };

  const duplicated = (await ensureRolesLoaded()).some(
    (item) => item.id !== id && item.name === name,
  );
  if (duplicated) fail("duplicate");

  await db
    .update(roles)
    .set({ name, description, tone, ...caps, updatedAt: new Date() })
    .where(eq(roles.id, id));

  invalidateRoles();

  if (current.admin && !caps.admin && !(await hasActiveAdminUser())) {
    await db
      .update(roles)
      .set({
        name: current.name,
        description: current.description,
        tone: current.tone,
        manage: current.manage,
        repair: current.repair,
        admin: current.admin,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, id));
    invalidateRoles();
    fail("last-admin");
  }

  await audit({
    entityType: "role",
    entityId: id,
    action: "role.update",
    detail: {
      from: { name: current.name, caps: { ...current } },
      to: { name, caps },
    },
    actorId: actor.id,
    actorName: actor.name,
  });
  revalidateRoles();
  redirect("/admin/settings/roles?ok=updated");
}

export async function deleteRole(formData: FormData) {
  const actor = await requireUser();
  if (!isAdmin(actor.role)) fail("forbidden");

  const id = String(formData.get("id") ?? "");
  if (!id) fail("missing");

  const current = (await ensureRolesLoaded()).find((item) => item.id === id);
  if (!current) fail("missing");
  if (current.builtin) fail("builtin");

  const [used] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.role, id))
    .limit(1);
  if (used) fail("in-use");

  await db.delete(roles).where(eq(roles.id, id));
  invalidateRoles();

  if (current.admin && !(await hasActiveAdminUser())) {
    await db.insert(roles).values({
      id: current.id,
      name: current.name,
      description: current.description,
      tone: current.tone,
      builtin: current.builtin,
      manage: current.manage,
      repair: current.repair,
      admin: current.admin,
      sortOrder: current.sortOrder,
    });
    invalidateRoles();
    fail("last-admin");
  }

  await audit({
    entityType: "role",
    entityId: id,
    action: "role.delete",
    detail: { name: current.name },
    actorId: actor.id,
    actorName: actor.name,
  });
  revalidateRoles();
  redirect("/admin/settings/roles?ok=deleted");
}
