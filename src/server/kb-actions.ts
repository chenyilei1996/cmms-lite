"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { kbArticleVotes, kbArticles, workOrders } from "@/db/schema";
import { audit } from "@/lib/audit";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/constants";
import {
  isKbCategory,
  normalizeTags,
  type KbCategory,
  type KbStatus,
} from "@/lib/kb";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function resolveCategory(formData: FormData): KbCategory {
  const raw = String(formData.get("category") ?? "");
  return isKbCategory(raw) ? raw : "fault_case";
}

async function nextCode() {
  const rows = await db.select({ code: kbArticles.code }).from(kbArticles);
  const max = rows.reduce((acc, row) => {
    const n = Number(row.code.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `KB-${String(max + 1).padStart(4, "0")}`;
}

function revalidateKb(id?: string) {
  revalidatePath("/app/kb");
  revalidatePath("/app/dashboard");
  if (id) revalidatePath(`/app/kb/${id}`);
}

export async function createKbArticle(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) redirect("/app/kb?error=forbidden");

  const title = text(formData, "title");
  const content = text(formData, "content");
  if (!title || !content) redirect("/app/kb/new?error=fields");

  const sourceRaw = text(formData, "sourceWorkOrderId");
  const sourceOrder = sourceRaw
    ? (
        await db
          .select({ id: workOrders.id })
          .from(workOrders)
          .where(eq(workOrders.id, sourceRaw))
          .limit(1)
      )[0]
    : undefined;

  const assetRaw = text(formData, "assetId");
  const faultCodeRaw = text(formData, "faultCodeId");
  const assetCategoryRaw = text(formData, "assetCategory");
  const wantPublish = formData.get("intent") === "publish" && canManage(user.role);
  const status: KbStatus = wantPublish ? "published" : "draft";
  const now = new Date();

  const [created] = await db
    .insert(kbArticles)
    .values({
      code: await nextCode(),
      title,
      summary: text(formData, "summary"),
      category: resolveCategory(formData),
      content,
      assetId: assetRaw,
      assetCategory:
        assetCategoryRaw && CATEGORIES.includes(assetCategoryRaw)
          ? assetCategoryRaw
          : null,
      faultCodeId: faultCodeRaw,
      tags: normalizeTags(formData.get("tags")),
      status,
      sourceWorkOrderId: sourceOrder?.id ?? null,
      authorId: user.id,
      authorName: user.name,
      publishedAt: wantPublish ? now : null,
      updatedAt: now,
    })
    .returning({ id: kbArticles.id, code: kbArticles.code });

  await audit({
    entityType: "kb_article",
    entityId: created.id,
    action: wantPublish ? "kb.publish" : "kb.create",
    detail: { code: created.code, title, status },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateKb(created.id);
  redirect(`/app/kb/${created.id}?ok=created`);
}

export async function updateKbArticle(formData: FormData) {
  const user = await requireUser();
  if (!canRepair(user.role)) redirect("/app/kb?error=forbidden");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/app/kb");

  const [row] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, id))
    .limit(1);
  if (!row) redirect("/app/kb?error=missing");
  if (row.status === "archived" && !canManage(user.role)) {
    redirect(`/app/kb/${id}?error=archived`);
  }

  const title = text(formData, "title") ?? row.title;
  const content = text(formData, "content") ?? row.content;
  const intent = String(formData.get("intent") ?? "save");
  const now = new Date();

  let status: KbStatus = row.status;
  if (intent === "archive" && canManage(user.role)) status = "archived";
  else if (intent === "publish" && canManage(user.role)) status = "published";
  else if (intent === "draft" && canManage(user.role)) status = "draft";

  const assetRaw = text(formData, "assetId");
  const faultCodeRaw = text(formData, "faultCodeId");
  const assetCategoryRaw = text(formData, "assetCategory");

  await db
    .update(kbArticles)
    .set({
      title,
      summary: text(formData, "summary"),
      category: resolveCategory(formData),
      content,
      assetId: assetRaw,
      assetCategory:
        assetCategoryRaw && CATEGORIES.includes(assetCategoryRaw)
          ? assetCategoryRaw
          : null,
      faultCodeId: faultCodeRaw,
      tags: normalizeTags(formData.get("tags")),
      status,
      publishedAt:
        status === "published" ? (row.publishedAt ?? now) : row.publishedAt,
      updatedAt: now,
    })
    .where(eq(kbArticles.id, id));

  await audit({
    entityType: "kb_article",
    entityId: id,
    action:
      status !== row.status
        ? `kb.${status}`
        : "kb.update",
    detail: { code: row.code, title, from: row.status, to: status },
    actorId: user.id,
    actorName: user.name,
  });
  revalidateKb(id);
  redirect(`/app/kb/${id}?ok=updated`);
}

export async function voteKbArticle(formData: FormData) {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const helpful = String(formData.get("helpful") ?? "1") === "1";
  if (!id) redirect("/app/kb");

  const [row] = await db
    .select({ id: kbArticles.id, status: kbArticles.status })
    .from(kbArticles)
    .where(eq(kbArticles.id, id))
    .limit(1);
  if (!row || row.status !== "published") redirect(`/app/kb/${id}`);

  await db
    .delete(kbArticleVotes)
    .where(
      and(eq(kbArticleVotes.articleId, id), eq(kbArticleVotes.userId, user.id)),
    );
  await db.insert(kbArticleVotes).values({ articleId: id, userId: user.id, helpful });

  const [helpfulRows, unhelpfulRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(kbArticleVotes)
      .where(
        and(eq(kbArticleVotes.articleId, id), eq(kbArticleVotes.helpful, true)),
      ),
    db
      .select({ n: count() })
      .from(kbArticleVotes)
      .where(
        and(eq(kbArticleVotes.articleId, id), eq(kbArticleVotes.helpful, false)),
      ),
  ]);

  await db
    .update(kbArticles)
    .set({
      helpfulCount: Number(helpfulRows[0]?.n ?? 0),
      unhelpfulCount: Number(unhelpfulRows[0]?.n ?? 0),
    })
    .where(eq(kbArticles.id, id));

  revalidateKb(id);
  redirect(`/app/kb/${id}?voted=${helpful ? "1" : "0"}`);
}
