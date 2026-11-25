import { Clock, Gauge, Pulse, Repeat, Warning } from "@phosphor-icons/react/dist/ssr";
import { and, asc, count, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  downtimeRecords,
  faultCodes,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { RESPONSIBILITY } from "@/lib/constants";
import {
  DataCutoff,
  ExportLink,
  ReportFilters,
  ReportNote,
  ReportTabs,
  SampleBadge,
} from "@/components/report-chrome";
import { Badge, Bar, PageHeader, StatCard } from "@/components/ui";
import {
  fmtHours,
  fmtMinutes,
  fmtPercent,
  inBucket,
  monthBuckets,
  periodRange,
  resolveDays,
} from "@/lib/reporting";

export const metadata = { title: "故障分析" };

export default async function FaultAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; asset?: string; code?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const days = resolveDays(sp.days);
  const now = new Date();
  const { since } = periodRange(days, now);
  const trendStart = monthBuckets(6, now)[0].start;

  const [recordRows, assetRows, codeRows, machineRows] = await Promise.all([
    db
      .select({
        record: downtimeRecords,
        assetName: assets.name,
        assetCode: assets.code,
        code: faultCodes.code,
        codeName: faultCodes.name,
      })
      .from(downtimeRecords)
      .innerJoin(assets, eq(downtimeRecords.assetId, assets.id))
      .leftJoin(faultCodes, eq(downtimeRecords.faultCodeId, faultCodes.id))
      .where(gte(downtimeRecords.startedAt, trendStart)),
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .where(
        and(
          inArray(assets.level, ["machine", "component"]),
          ne(assets.status, "retired"),
        ),
      )
      .orderBy(asc(assets.code)),
    db
      .select({ id: faultCodes.id, code: faultCodes.code, name: faultCodes.name })
      .from(faultCodes)
      .orderBy(asc(faultCodes.code)),
    db
      .select({ n: count() })
      .from(assets)
      .where(
        and(
          inArray(assets.level, ["machine", "component"]),
          ne(assets.status, "retired"),
        ),
      ),
  ]);

  const filtered = recordRows.filter((row) => {
    if (sp.asset && row.record.assetId !== sp.asset) return false;
    if (sp.code && row.record.faultCodeId !== sp.code) return false;
    return true;
  });
  const periodRows = filtered.filter((row) => row.record.startedAt >= since);
  const unplanned = periodRows.filter((row) => row.record.type === "unplanned");
  const unplannedMinutes = unplanned.reduce(
    (sum, row) => sum + row.record.minutes,
    0,
  );
  const totalMinutes = periodRows.reduce(
    (sum, row) => sum + row.record.minutes,
    0,
  );
  const affected = periodRows.reduce(
    (sum, row) => sum + (row.record.affectedOutput ?? 0),
    0,
  );
  const machineCount = Math.max(1, Number(machineRows[0]?.n ?? 1));
  const available = days * 24 * 60 * machineCount;
  const mttr = unplanned.length ? unplannedMinutes / unplanned.length : null;
  const mtbfHours = unplanned.length
    ? Math.max(0, available - totalMinutes) / unplanned.length / 60
    : null;

  const codeStats = new Map<
    string,
    { code: string; name: string; count: number; minutes: number }
  >();
  for (const row of unplanned) {
    const key = row.record.faultCodeId ?? "none";
    const entry = codeStats.get(key) ?? {
      code: row.code ?? "—",
      name: row.codeName ?? "未分类",
      count: 0,
      minutes: 0,
    };
    entry.count += 1;
    entry.minutes += row.record.minutes;
    codeStats.set(key, entry);
  }
  const sortedCodes = [...codeStats.values()].sort(
    (a, b) => b.count - a.count || b.minutes - a.minutes,
  );
  const pareto = sortedCodes.map((item, index) => {
    const cumulativeCount = sortedCodes
      .slice(0, index + 1)
      .reduce((sum, row) => sum + row.count, 0);
    return {
      ...item,
      cumulativePct: unplanned.length
        ? (cumulativeCount / unplanned.length) * 100
        : 0,
    };
  });
  const maxPareto = Math.max(...pareto.map((item) => item.count), 1);

  const buckets = monthBuckets(6, now).map((bucket) => {
    const rows = filtered.filter(
      (row) =>
        row.record.type === "unplanned" &&
        inBucket(row.record.startedAt, bucket),
    );
    const minutes = rows.reduce((sum, row) => sum + row.record.minutes, 0);
    const monthDays = Math.round(
      (bucket.end.getTime() - bucket.start.getTime()) / 86400000,
    );
    const monthAvailable = monthDays * 24 * 60 * machineCount;
    return {
      ...bucket,
      count: rows.length,
      minutes,
      mttr: rows.length ? minutes / rows.length : null,
      mtbfHours: rows.length
        ? Math.max(0, monthAvailable - minutes) / rows.length / 60
        : null,
    };
  });

  const assetStats = new Map<
    string,
    { name: string; code: string; count: number; minutes: number; lastCode: string }
  >();
  for (const row of unplanned) {
    const entry = assetStats.get(row.record.assetId) ?? {
      name: row.assetName,
      code: row.assetCode,
      count: 0,
      minutes: 0,
      lastCode: row.code ?? "未分类",
    };
    entry.count += 1;
    entry.minutes += row.record.minutes;
    entry.lastCode = row.code ?? entry.lastCode;
    assetStats.set(row.record.assetId, entry);
  }
  const repeatAssets = [...assetStats.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count || b.minutes - a.minutes)
    .slice(0, 8);

  const responsibility = new Map<string, number>();
  for (const row of unplanned) {
    responsibility.set(
      row.record.responsibility,
      (responsibility.get(row.record.responsibility) ?? 0) + 1,
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Reports · reliability"
        title="故障分析"
        description="故障 Pareto、MTBF/MTTR 趋势、重复故障与停机责任分布。故障次数少于 5 次时标记样本不足。"
        actions={
          <ExportLink
            report="faults"
            days={days}
            filters={{ asset: sp.asset, code: sp.code }}
          />
        }
      />
      <ReportTabs active="/admin/analytics/faults" />
      <ReportFilters
        basePath="/admin/analytics/faults"
        days={days}
        selects={[
          {
            name: "asset",
            label: "设备",
            value: sp.asset,
            allLabel: "全部设备",
            options: assetRows.map((row) => ({
              value: row.id,
              label: `${row.code} · ${row.name}`,
            })),
          },
          {
            name: "code",
            label: "故障代码",
            value: sp.code,
            allLabel: "全部代码",
            options: codeRows.map((row) => ({
              value: row.id,
              label: `${row.code} · ${row.name}`,
            })),
          },
        ]}
      />
      <DataCutoff
        now={now}
        days={days}
        extra={
          <>
            非计划故障 {unplanned.length} 次 <SampleBadge sample={unplanned.length} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="非计划故障"
          value={unplanned.length}
          tone="danger"
          icon={<Warning className="size-4" />}
          sub="剔除计划停机"
        />
        <StatCard
          label="MTTR"
          value={mttr === null ? "—" : fmtMinutes(mttr)}
          tone="accent"
          icon={<Pulse className="size-4" />}
          sub="平均修复时长"
        />
        <StatCard
          label="MTBF"
          value={mtbfHours === null ? "—" : fmtHours(mtbfHours)}
          tone="mint"
          icon={<Gauge className="size-4" />}
          sub={`${machineCount} 台设备折算`}
        />
        <StatCard
          label="总停机时长"
          value={fmtMinutes(totalMinutes)}
          tone="honey"
          icon={<Clock className="size-4" />}
          sub={`${periodRows.length} 条停机记录`}
        />
        <StatCard
          label="影响产量"
          value={affected.toLocaleString("zh-CN")}
          tone="neutral"
          icon={<Warning className="size-4" />}
          sub="按停机记录汇总"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">故障 Pareto</h2>
            <span className="label-mono">CUMULATIVE %</span>
          </div>
          {pareto.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">
              当前筛选下没有非计划故障。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {pareto.slice(0, 8).map((item) => (
                <li key={`${item.code}-${item.name}`} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-[10px] text-muted">
                        {item.code}
                      </span>{" "}
                      <span className="font-medium">{item.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {item.count} 次 · {fmtMinutes(item.minutes)} · 累计{" "}
                      {item.cumulativePct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper">
                      <div
                        className="h-full rounded-full bg-danger/70"
                        style={{
                          width: `${Math.max(6, (item.count / maxPareto) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-[9px] text-muted">
                      {item.cumulativePct.toFixed(0)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">重复故障设备</h2>
            <span className="label-mono">≥ 2 TIMES</span>
          </div>
          {repeatAssets.length === 0 ? (
            <p className="px-5 py-6 text-[12px] text-muted">
              当前周期没有重复故障设备。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {repeatAssets.map((item) => (
                <li
                  key={item.code}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-[12px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                      {item.code} · 最近代码 {item.lastCode} · {fmtMinutes(item.minutes)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 font-mono text-[10px] text-danger">
                    <Repeat className="size-3" /> {item.count} 次
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[13px] font-semibold">MTTR / MTBF 月度趋势</h2>
            <span className="label-mono">LAST 6 MONTHS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] text-muted">
                  <th className="px-5 py-2.5 font-medium">月份</th>
                  <th className="px-3 py-2.5 text-right font-medium">故障次数</th>
                  <th className="px-3 py-2.5 text-right font-medium">停机</th>
                  <th className="px-3 py-2.5 text-right font-medium">MTTR</th>
                  <th className="px-5 py-2.5 text-right font-medium">MTBF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {buckets.map((bucket) => (
                  <tr key={bucket.key}>
                    <td className="px-5 py-2.5">{bucket.label}</td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {bucket.count}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px] text-muted">
                      {fmtMinutes(bucket.minutes)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {bucket.mttr === null ? "—" : fmtMinutes(bucket.mttr)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono">
                      {bucket.mtbfHours === null ? "—" : fmtHours(bucket.mtbfHours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-[13px] font-semibold">责任归属</h2>
          {responsibility.size === 0 ? (
            <p className="text-[12px] text-muted">暂无数据。</p>
          ) : (
            <div className="space-y-3">
              {[...responsibility.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([key, value]) => {
                  const meta = RESPONSIBILITY[key] ?? {
                    label: key,
                    tone: "neutral" as const,
                  };
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="font-mono text-muted">
                          {value} 次 · {fmtPercent(value, unplanned.length)}
                        </span>
                      </div>
                      <Bar value={value} total={unplanned.length} tone="ink" />
                    </div>
                  );
                })}
            </div>
          )}
          <p className="mt-4 text-[10px] leading-relaxed text-muted">
            计划停机 {periodRows.length - unplanned.length} 条，不计入故障次数与 MTTR。
          </p>
        </section>
      </div>

      <ReportNote>
        Pareto 按故障代码出现次数降序累计；MTTR = 非计划停机分钟 ÷ 非计划故障次数；MTBF = 当月可用分钟扣除停机后 ÷ 故障次数 ÷ 60。重复故障为同一设备在统计期内出现 2 次及以上非计划故障。当前无 IoT 运行时长，MTBF 以日历时间近似。
      </ReportNote>
    </>
  );
}
