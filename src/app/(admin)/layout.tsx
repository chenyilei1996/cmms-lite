import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { canManage, requireUser } from "@/lib/auth";

export const metadata = { title: "管理后台" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/app/dashboard");
  return <AdminShell user={user}>{children}</AdminShell>;
}
