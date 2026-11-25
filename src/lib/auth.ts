import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "./constants";
import { requireSecret } from "./env";
import { capsOf, ensureRolesLoaded } from "./roles";

export const SESSION_COOKIE = "cmms_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

const secret = () =>
  new TextEncoder().encode(
    requireSecret("SESSION_SECRET", "dev-only-change-me-9f3a1c7e5b2d4a6f"),
  );

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/**
 * 校验会话并实时读取账号状态：停用或删除后立即失效，不等 JWT 过期。
 * 接口路由用它替代 getSession，避免停用账号在 7 天有效期内继续调用 API。
 */
export async function getActiveUser(): Promise<SessionUser | null> {
  const user = await getSession();
  if (!user) return null;
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || !row.active) return null;
  await ensureRolesLoaded();
  return {
    id: user.id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  const active = await getActiveUser();
  if (!active) redirect("/login?expired=1");
  return active;
}

export function canManage(role: Role) {
  return capsOf(role).manage;
}

export function canRepair(role: Role) {
  const caps = capsOf(role);
  return caps.repair || caps.manage || caps.admin;
}

export function isAdmin(role: Role) {
  return capsOf(role).admin;
}
