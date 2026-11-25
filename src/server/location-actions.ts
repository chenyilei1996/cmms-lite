"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { assets, locations } from "@/db/schema";
import { audit } from "@/lib/audit";
import { canManage, requireUser } from "@/lib/auth";

const BASE = "/admin/assets/locations";

function revalidateLocations() {
  revalidatePath(BASE);
  revalidatePath("/admin/assets");
  revalidatePath("/admin/assets/new");
  revalidatePath("/app/assets");
}

/** 位置维护属于设备主数据配置，仅管理员与主管可用。 */
export async function createLocation(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/app/dashboard");

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const sort = Math.round(Number(formData.get("sort") ?? 0)) || 0;
  if (!name) redirect(`${BASE}?error=name_required`);
  if (!code) redirect(`${BASE}?error=code_required`);

  const [duplicate] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.code, code))
    .limit(1);
  if (duplicate) redirect(`${BASE}?error=duplicate`);

  const [created] = await db
    .insert(locations)
    .values({ name, code, sort })
    .returning({ id: locations.id });

  await audit({
    entityType: "location",
    entityId: created?.id ?? null,
    action: "location.create",
    detail: { name, code, sort },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateLocations();
  redirect(`${BASE}?ok=created`);
}

export async function updateLocation(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/app/dashboard");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${BASE}?error=not_found`);

  const [row] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, id))
    .limit(1);
  if (!row) redirect(`${BASE}?error=not_found`);

  const name = String(formData.get("name") ?? "").trim() || row.name;
  const code =
    String(formData.get("code") ?? "").trim().toUpperCase() || row.code;
  const sortRaw = formData.get("sort");
  const sort =
    sortRaw === null || String(sortRaw).trim() === ""
      ? row.sort
      : Math.round(Number(sortRaw)) || row.sort;

  const [duplicate] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.code, code), ne(locations.id, id)))
    .limit(1);
  if (duplicate) redirect(`${BASE}?error=duplicate`);

  await db.update(locations).set({ name, code, sort }).where(eq(locations.id, id));
  await audit({
    entityType: "location",
    entityId: id,
    action: "location.update",
    detail: { from: { name: row.name, code: row.code, sort: row.sort }, to: { name, code, sort } },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateLocations();
  redirect(`${BASE}?ok=updated`);
}

export async function deleteLocation(formData: FormData) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/app/dashboard");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${BASE}?error=not_found`);

  const [row] = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.id, id))
    .limit(1);
  if (!row) redirect(`${BASE}?error=not_found`);

  const [used] = await db
    .select({ value: count() })
    .from(assets)
    .where(eq(assets.locationId, id));
  if (Number(used?.value ?? 0) > 0) redirect(`${BASE}?error=in_use`);

  await db.delete(locations).where(eq(locations.id, id));
  await audit({
    entityType: "location",
    entityId: id,
    action: "location.delete",
    detail: { name: row.name },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateLocations();
  redirect(`${BASE}?ok=deleted`);
}
