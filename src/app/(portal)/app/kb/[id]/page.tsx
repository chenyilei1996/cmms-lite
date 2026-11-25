import { ArrowLeft, ArrowUpRight, BookOpenText, ClipboardText, Cube, Eye, PencilSimple, ThumbsDown, ThumbsUp } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  faultCodes,
  kbArticleVotes,
  kbArticles,
  workOrders,
} from "@/db/schema";
import { canManage, canRepair, requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import {
  KB_CATEGORIES,
  KB_STATUS,
  helpfulRate,
  parseTags,
  type KbCategory,
  type KbStatus,
} from "@/lib/kb";
import { Badge, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { KbBody } from "@/components/kb-body";
import { voteKbArticle } from "@/server/kb-actions";

export const metadata = { title: "知识详情" };

export default async function KnowledgeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    ok?: string;
    voted?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const [row] = await db
    .select({
      article: kbArticles,
      assetName: assets.name,
      assetCode: assets.code,
      faultCode: faultCodes.code,
      faultCodeName: faultCodes.name,
      sourceCode: workOrders.code,
    })
    .from(kbArticles)
    .leftJoin(assets, eq(kbArticles.assetId, assets.id))
    .leftJoin(faultCodes, eq(kbArticles.faultCodeId, faultCodes.id))
    .leftJoin(workOrders, eq(kbArticles.sourceWorkOrderId, workOrders.id))
    .where(eq(kbArticles.id, id))
    .limit(1);

  if (!row) notFound();
  const article = row.article;
  const manageable = canManage(user.role);
  const writable = canRepair(user.role);
  const isAuthor = article.authorId === user.id;

  if (article.status === "archived" && !manageable) notFound();
  if (
    article.status === "draft" &&
    !manageable &&
    !isAuthor
  ) {
    notFound();
  }

  const matchConditions = [eq(kbArticles.category, article.category)];
  if (article.assetId) {
    matchConditions.push(eq(kbArticles.assetId, article.assetId));
  }
  if (article.assetCategory) {
    matchConditions.push(eq(kbArticles.assetCategory, article.assetCategory));
  }

  const [relatedRows, votes] = await Promise.all([
    db
      .select({
        id: kbArticles.id,
        code: kbArticles.code,
        title: kbArticles.title,
        category: kbArticles.category,
        helpfulCount: kbArticles.helpfulCount,
      })
      .from(kbArticles)
      .where(
        and(
          eq(kbArticles.status, "published"),
          ne(kbArticles.id, article.id),
          or(...matchConditions),
        ),
      )
      .orderBy(desc(kbArticles.helpfulCount), desc(kbArticles.updatedAt))
      .limit(4),
    db
      .select({ helpful: kbArticleVotes.helpful })
      .from(kbArticleVotes)
      .where(
        and(
          eq(kbArticleVotes.articleId, article.id),
          eq(kbArticleVotes.userId, user.id),
        ),
      )
      .limit(1),
  ]);

  await db
    .update(kbArticles)
    .set({ views: sql`${kbArticles.views} + 1` })
    .where(eq(kbArticles.id, article.id));

  const meta = KB_CATEGORIES[article.category];
  const tags = parseTags(article.tags);
  const myVote = votes[0]?.helpful;
  const views = article.views + 1;
  const rate = helpfulRate(article.helpfulCount, article.unhelpfulCount);
  const canEdit = writable && (article.status !== "archived" || manageable);

  return (
    <>
      <PageHeader
        eyebrow={`${article.code} · ${meta.label}`}
        title={article.title}
        description={article.summary ?? undefined}
        actions={
          <>
            <LinkButton href="/app/kb" variant="secondary">
              <ArrowLeft className="size-4" /> 知识库
            </LinkButton>
            {canEdit && (
              <LinkButton href={`/app/kb/${article.id}/edit`}>
                <PencilSimple className="size-4" /> 编辑
              </LinkButton>
            )}
          </>
        }
      />

      {sp.ok === "created" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          知识已创建。{article.status === "draft" ? "提交给主管发布后全员可见。" : "已发布。"}
        </p>
      )}
      {sp.ok === "updated" && (
        <p className="mb-4 rounded-xl bg-mint-soft/60 px-4 py-3 text-[12px] text-mint">
          知识已更新。
        </p>
      )}
      {sp.error === "archived" && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-[12px] text-danger">
          已归档知识只能由主管修改。
        </p>
      )}
      {sp.voted && (
        <p className="mb-4 rounded-xl bg-accent-soft/60 px-4 py-3 text-[12px] text-accent-ink">
          已记录你的评价（{sp.voted === "1" ? "有帮助" : "没帮助"}），可随时更改。
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_310px]">
        <div className="space-y-4">
          <section className="card p-5 lg:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <Badge tone={KB_STATUS[article.status as KbStatus].tone}>
                {KB_STATUS[article.status as KbStatus].label}
              </Badge>
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <Eye className="size-3.5" /> {views} 次浏览
              </span>
              <span className="text-[11px] text-muted">
                {article.authorName ?? "系统"} · {fmtDate(article.updatedAt)}
              </span>
            </div>

            <div className="border-t border-line pt-4">
              <KbBody content={article.content} />
            </div>

            {tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line pt-4">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/app/kb?q=${encodeURIComponent(tag)}`}
                    className="rounded-full bg-paper px-2.5 py-1 text-[10px] text-muted ring-1 ring-line transition-colors hover:text-ink"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <SectionTitle
              title="这条知识对你有帮助吗？"
              extra={
                <span className="font-mono text-[10px] text-muted">
                  有用率 {rate}%
                </span>
              }
            />
            <form action={voteKbArticle} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={article.id} />
              <SubmitButton
                name="helpful"
                value="1"
                variant={myVote === true ? "primary" : "secondary"}
                size="sm"
              >
                <ThumbsUp className="size-3.5" /> 有帮助 · {article.helpfulCount}
              </SubmitButton>
              <SubmitButton
                name="helpful"
                value="0"
                variant={myVote === false ? "primary" : "secondary"}
                size="sm"
              >
                <ThumbsDown className="size-3.5" /> 没帮助 · {article.unhelpfulCount}
              </SubmitButton>
              {article.status !== "published" && (
                <span className="text-[11px] text-muted">
                  草稿发布后才会出现在检索结果中。
                </span>
              )}
            </form>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <SectionTitle title="关联信息" />
            <dl className="space-y-3 text-[12px]">
              <div>
                <dt className="text-[10px] text-muted">适用设备</dt>
                <dd className="mt-1">
                  {article.assetId ? (
                    <Link
                      href={`/app/assets/${article.assetId}`}
                      className="flex items-center gap-2 text-ink-soft hover:text-accent-ink"
                    >
                      <Cube className="size-3.5 text-muted" />
                      {row.assetName}
                      <span className="font-mono text-[10px] text-muted">
                        {row.assetCode}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-muted">未指定</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted">设备类别</dt>
                <dd className="mt-1 text-ink-soft">
                  {article.assetCategory ?? "未指定"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted">故障代码</dt>
                <dd className="mt-1 text-ink-soft">
                  {row.faultCode ? `${row.faultCode} · ${row.faultCodeName}` : "未关联"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted">来源工单</dt>
                <dd className="mt-1">
                  {article.sourceWorkOrderId ? (
                    <Link
                      href={`/app/work-orders/${article.sourceWorkOrderId}`}
                      className="flex items-center gap-1.5 text-ink-soft hover:text-accent-ink"
                    >
                      <ClipboardText className="size-3.5 text-muted" />
                      {row.sourceCode}
                      <ArrowUpRight className="size-3" />
                    </Link>
                  ) : (
                    <span className="text-muted">无（手工创建）</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted">最近更新</dt>
                <dd className="mt-1 text-ink-soft">
                  {fmtDateTime(article.updatedAt)}
                </dd>
              </div>
              {article.publishedAt && (
                <div>
                  <dt className="text-[10px] text-muted">发布时间</dt>
                  <dd className="mt-1 text-ink-soft">
                    {fmtDateTime(article.publishedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="card p-5">
            <SectionTitle
              title="相关知识"
              extra={<BookOpenText className="size-4 text-muted" />}
            />
            {relatedRows.length === 0 ? (
              <p className="text-[12px] text-muted">
                暂无同设备或同分类的已发布知识。
              </p>
            ) : (
              <ul className="space-y-2.5">
                {relatedRows.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/app/kb/${item.id}`}
                      className="block rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-ink/25"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={KB_CATEGORIES[item.category as KbCategory].tone}
                        >
                          {KB_CATEGORIES[item.category as KbCategory].label}
                        </Badge>
                        <span className="font-mono text-[9px] text-muted">
                          {item.code}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug">
                        {item.title}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted">
                        <ThumbsUp className="size-3" /> {item.helpfulCount} 人觉得有用
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
