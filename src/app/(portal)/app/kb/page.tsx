import { BookOpenText, Eye, MagnifyingGlass, Plus, Sparkle, ThumbsUp, TreeStructure } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, faultCodes, kbArticles } from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/constants";
import {
  KB_CATEGORIES,
  KB_CATEGORY_KEYS,
  KB_STATUS,
  helpfulRate,
  parseTags,
  type KbCategory,
  type KbStatus,
} from "@/lib/kb";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { KbQaPanel } from "@/components/kb-qa-panel";
import { getAiConfig } from "@/lib/ai-config";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "设备知识库" };

const control =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    assetCategory?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const manageable = canManage(user.role);
  const writable = canRepair(user.role);
  const ai = await getAiConfig();

  const q = sp.q?.trim() ?? "";
  const category = sp.category && sp.category in KB_CATEGORIES ? sp.category : "";
  const assetCategory = sp.assetCategory ?? "";
  const statusFilter =
    sp.status === "published" || sp.status === "draft" || sp.status === "archived"
      ? sp.status
      : "";

  const conditions = [];

  if (statusFilter === "published") {
    conditions.push(eq(kbArticles.status, "published"));
  } else if (statusFilter === "draft" && writable) {
    conditions.push(eq(kbArticles.status, "draft"));
    if (!manageable) conditions.push(eq(kbArticles.authorId, user.id));
  } else if (statusFilter === "archived" && manageable) {
    conditions.push(eq(kbArticles.status, "archived"));
  } else if (manageable) {
    conditions.push(inArray(kbArticles.status, ["published", "draft"]));
  } else if (writable) {
    conditions.push(
      or(
        eq(kbArticles.status, "published"),
        and(eq(kbArticles.status, "draft"), eq(kbArticles.authorId, user.id)),
      ),
    );
  } else {
    conditions.push(eq(kbArticles.status, "published"));
  }

  if (category) {
    conditions.push(eq(kbArticles.category, category as KbCategory));
  }
  if (assetCategory && CATEGORIES.includes(assetCategory)) {
    conditions.push(eq(kbArticles.assetCategory, assetCategory));
  }
  if (q) {
    conditions.push(
      or(
        ilike(kbArticles.title, `%${q}%`),
        ilike(kbArticles.summary, `%${q}%`),
        ilike(kbArticles.content, `%${q}%`),
        ilike(kbArticles.tags, `%${q}%`),
        ilike(kbArticles.code, `%${q}%`),
      ),
    );
  }

  const [rows, publishedRows, draftRows] = await Promise.all([
    db
      .select({
        article: kbArticles,
        assetName: assets.name,
        faultCodeName: faultCodes.name,
      })
      .from(kbArticles)
      .leftJoin(assets, eq(kbArticles.assetId, assets.id))
      .leftJoin(faultCodes, eq(kbArticles.faultCodeId, faultCodes.id))
      .where(and(...conditions))
      .orderBy(
        desc(kbArticles.helpfulCount),
        desc(sql`coalesce(${kbArticles.publishedAt}, ${kbArticles.updatedAt})`),
      ),
    db
      .select({
        total: count(),
        views: sql<number>`coalesce(sum(${kbArticles.views}), 0)`,
        helpful: sql<number>`coalesce(sum(${kbArticles.helpfulCount}), 0)`,
        unhelpful: sql<number>`coalesce(sum(${kbArticles.unhelpfulCount}), 0)`,
        categories: sql<number>`count(distinct ${kbArticles.assetCategory})`,
      })
      .from(kbArticles)
      .where(eq(kbArticles.status, "published")),
    db
      .select({ n: count() })
      .from(kbArticles)
      .where(
        manageable
          ? eq(kbArticles.status, "draft")
          : and(
              eq(kbArticles.status, "draft"),
              eq(kbArticles.authorId, user.id),
            ),
      ),
  ]);

  const summary = publishedRows[0];
  const total = Number(summary?.total ?? 0);
  const views = Number(summary?.views ?? 0);
  const rate = helpfulRate(
    Number(summary?.helpful ?? 0),
    Number(summary?.unhelpful ?? 0),
  );
  const categoryCoverage = Number(summary?.categories ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Knowledge base"
        title="设备知识库"
        description="把故障案例、维修方案、操作规程与备件替代沉淀下来，现场扫码报修和接单时随时可查，减少重复摸索。"
        actions={
          <>
            {manageable && (
              <LinkButton href="/admin/faults/codes" variant="secondary">
                <BookOpenText className="size-4" /> 故障代码库
              </LinkButton>
            )}
            {writable && (
              <LinkButton href="/app/kb/new">
                <Plus className="size-4" /> 新建知识
              </LinkButton>
            )}
          </>
        }
      />

      <KbQaPanel ready={ai.enabled} model={ai.model} />

      {sp.ok === "created" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          知识已创建，可继续完善后发布。
        </p>
      )}
      {sp.error === "forbidden" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          当前角色没有维护知识库的权限。
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="已发布知识"
          value={total}
          tone="mint"
          icon={<BookOpenText className="size-4" />}
          sub={draftRows[0] ? `另有 ${Number(draftRows[0].n)} 篇草稿` : undefined}
        />
        <StatCard
          label="累计浏览"
          value={views}
          tone="accent"
          icon={<Eye className="size-4" />}
          sub="按知识详情打开次数"
        />
        <StatCard
          label="有用率"
          value={`${rate}%`}
          tone="honey"
          icon={<ThumbsUp className="size-4" />}
          sub="来自现场人员的评价"
        />
        <StatCard
          label="覆盖设备类别"
          value={categoryCoverage}
          tone="neutral"
          icon={<TreeStructure className="size-4" />}
          sub="已关联到具体设备类别"
        />
      </div>

      <form
        method="get"
        className="card mb-5 grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_150px_140px_140px_auto]"
      >
        <label className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索标题、正文、标签或编号"
            className={`${control} pl-9`}
          />
        </label>
        <select name="category" defaultValue={category} className={control}>
          <option value="">全部分类</option>
          {KB_CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {KB_CATEGORIES[key].label}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={statusFilter} className={control}>
          <option value="">可见范围</option>
          <option value="published">已发布</option>
          {writable && <option value="draft">草稿</option>}
          {manageable && <option value="archived">已归档</option>}
        </select>
        <select name="assetCategory" defaultValue={assetCategory} className={control}>
          <option value="">全部设备类别</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-ink px-5 text-[12px] font-medium text-white transition-colors hover:bg-ink-soft"
        >
          筛选
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<BookOpenText className="size-7" />}
          title={q || category || assetCategory ? "没有匹配的知识" : "知识库还是空的"}
          hint={
            q || category || assetCategory
              ? "换一个关键词，或清除筛选条件再看看。"
              : "从已完成工单沉淀第一篇故障案例，现场维修会越来越快。"
          }
          action={
            writable ? (
              <LinkButton href="/app/kb/new" size="sm">
                <Plus className="size-3.5" /> 新建知识
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map(({ article, assetName, faultCodeName }) => {
            const meta = KB_CATEGORIES[article.category];
            const tags = parseTags(article.tags);
            return (
              <Link
                key={article.id}
                href={`/app/kb/${article.id}`}
                className="card group block p-5 transition-colors hover:border-ink/25"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] tracking-wider text-muted">
                        {article.code}
                      </span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {article.status !== "published" && (
                        <Badge tone={KB_STATUS[article.status as KbStatus].tone}>
                          {KB_STATUS[article.status as KbStatus].label}
                        </Badge>
                      )}
                      {article.faultCodeId && (
                        <Badge tone="neutral">故障代码 · {faultCodeName}</Badge>
                      )}
                    </div>
                    <h2 className="mt-2 text-[15px] font-semibold text-ink transition-colors group-hover:text-accent-ink">
                      {article.title}
                    </h2>
                    {article.summary && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                        {article.summary}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                      {assetName && <span>适用设备：{assetName}</span>}
                      {article.assetCategory && (
                        <span>设备类别：{article.assetCategory}</span>
                      )}
                      <span>更新 {fmtDate(article.updatedAt)}</span>
                      <span>{article.authorName ?? "系统"}</span>
                    </div>
                    {tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-paper px-2 py-0.5 text-[10px] text-muted ring-1 ring-line"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-[11px] text-muted sm:flex-col sm:items-end sm:gap-1.5">
                    <span className="flex items-center gap-1">
                      <Eye className="size-3.5" /> {article.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="size-3.5" /> {article.helpfulCount}
                    </span>
                    <span className="flex items-center gap-1 text-accent-ink">
                      <Sparkle className="size-3.5" />
                      {helpfulRate(article.helpfulCount, article.unhelpfulCount)}%
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
