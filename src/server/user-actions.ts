"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { createSession, isAdmin, requireUser } from "@/lib/auth";
import type { Role } from "@/lib/constants";
import { capsOf, listRoles } from "@/lib/roles";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

async function parseRole(value: string): Promise<Role | null> {
  const rows = await listRoles();
  return rows.some((item) => item.id === value) ? value : null;
}

async function activeAdminCount(excludeId?: string) {
  const adminRoleIds = (await listRoles())
    .filter((item) => item.admin)
    .map((item) => item.id);
  if (adminRoleIds.length === 0) return 0;
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(
      and(
        inArray(users.role, adminRoleIds),
        eq(users.active, true),
        excludeId ? ne(users.id, excludeId) : undefined,
      ),
    );
  return Number(row?.value ?? 0);
}

function revalidateUsers() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/users");
  revalidatePath("/admin/settings/roles");
}

function usersError(code: string): never {
  redirect(`/admin/settings/users?error=${code}`);
}

export async function createUser(formData: FormData) {
  const actor = await requireUser();
  if (!isAdmin(actor.role)) usersError("forbidden");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = await parseRole(String(formData.get("role") ?? "technician"));

  if (!name || !email || !password || !role) usersError("fields");
  if (!EMAIL_RE.test(email)) usersError("email");
  if (password.length < MIN_PASSWORD) usersError("password");

  const [duplicate] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (duplicate) usersError("duplicate");

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({ name, email, passwordHash, role })
    .returning({ id: users.id });

  await audit({
    entityType: "user",
    entityId: created.id,
    action: "user.create",
    detail: { name, email, role },
    actorId: actor.id,
    actorName: actor.name,
  });
  revalidateUsers();
  redirect("/admin/settings/users?ok=created");
}

export async function updateUser(formData: FormData) {
  const actor = await requireUser();
  if (!isAdmin(actor.role)) usersError("forbidden");

  const id = String(formData.get("id") ?? "");
  if (!id) usersError("missing");
  if (id === actor.id) usersError("self");

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) usersError("missing");

  const name = String(formData.get("name") ?? "").trim();
  const role = await parseRole(String(formData.get("role") ?? target.role));
  const active = formData.get("active") === "on";
  if (!name || !role) usersError("fields");

  if (
    capsOf(target.role).admin &&
    (!capsOf(role).admin || !active) &&
    (await activeAdminCount(target.id)) === 0
  ) {
    usersError("last-admin");
  }

  await db
    .update(users)
    .set({ name, role, active, updatedAt: new Date() })
    .where(eq(users.id, id));

  await audit({
    entityType: "user",
    entityId: id,
    action: "user.update",
    detail: {
      from: { name: target.name, role: target.role, active: target.active },
      to: { name, role, active },
    },
    actorId: actor.id,
    actorName: actor.name,
  });
  revalidateUsers();
  redirect("/admin/settings/users?ok=updated");
}

export async function toggleUserActive(formData: FormData) {
  const actor = await requireUser();
  if (!isAdmin(actor.role)) usersError("forbidden");

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  if (!id) usersError("missing");
  if (id === actor.id) usersError("self");

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) usersError("missing");

  if (
    capsOf(target.role).admin &&
    target.active &&
    !active &&
    (await activeAdminCount(target.id)) === 0
  ) {
    usersError("last-admin");
  }

  await db
    .update(users)
    .set({ active, updatedAt: new Date() })
    .where(eq(users.id, id));

  await audit({
    entityType: "user",
    entityId: id,
    action: active ? "user.activate" : "user.deactivate",
    detail: { email: target.email },
    actorId: actor.id,
    actorName: actor.name,
  });
  revalidateUsers();
  redirect(`/admin/settings/users?ok=${active ? "activated" : "deactivated"}`);
}

export async function resetUserPassword(formData: FormData) {
  const actor = await requireUser();
  if (!isAdmin(actor.role)) usersError("forbidden");

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id) usersError("missing");
  if (id === actor.id) usersError("self");
  if (password.length < MIN_PASSWORD) usersError("password");

  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) usersError("missing");

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id));

  await audit({
    entityType: "user",
    entityId: id,
    action: "user.password.reset",
    detail: { email: target.email },
    actorId: actor.id,
    actorName: actor.name,
  });
  revalidateUsers();
  redirect("/admin/settings/users?ok=password");
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/app/profile?error=fields");

  await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await createSession({ ...user, name });
  await audit({
    entityType: "user",
    entityId: user.id,
    action: "user.profile.update",
    detail: { from: user.name, to: name },
    actorId: user.id,
    actorName: name,
  });
  revalidatePath("/", "layout");
  revalidatePath("/app/profile");
  redirect("/app/profile?ok=profile");
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !next || !confirm) {
    redirect("/app/profile?error=password-fields");
  }
  if (next.length < MIN_PASSWORD) {
    redirect("/app/profile?error=password-length");
  }
  if (next !== confirm) {
    redirect("/app/profile?error=password-match");
  }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) {
    redirect("/app/profile?error=password-current");
  }

  const passwordHash = await bcrypt.hash(next, 10);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await audit({
    entityType: "user",
    entityId: user.id,
    action: "user.password.change",
    actorId: user.id,
    actorName: user.name,
  });
  revalidatePath("/app/profile");
  redirect("/app/profile?ok=password");
}
