"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { createSession, destroySession } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string };

const GENERIC_ERROR = "邮箱或密码不正确";

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/app/dashboard");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/app/dashboard";

  if (!email || !password) {
    return { error: "请输入邮箱和密码" };
  }

  // 防爆破：IP 与账号双维度限流，共享办公网 30 次 / 10 分钟，单账号 10 次 / 10 分钟
  const ip = await getClientIp();
  const [ipHit, accountHit] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 30, 600),
    rateLimit(`login:email:${email}`, 10, 600),
  ]);
  if (!ipHit.allowed || !accountHit.allowed) {
    const retry = Math.max(ipHit.retryAfterSeconds, accountHit.retryAfterSeconds);
    await audit({
      entityType: "auth",
      action: "auth.login.blocked",
      detail: { email },
      actorName: email,
      ip,
    });
    return { error: `尝试次数过多，请 ${retry} 秒后再试` };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.active) {
    await audit({
      entityType: "auth",
      action: "auth.login.failed",
      detail: { email, reason: user ? "inactive" : "unknown" },
      actorName: email,
      ip,
    });
    return { error: GENERIC_ERROR };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await audit({
      entityType: "auth",
      entityId: user.id,
      action: "auth.login.failed",
      detail: { email, reason: "bad_password" },
      actorId: user.id,
      actorName: user.name,
      ip,
    });
    return { error: GENERIC_ERROR };
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
