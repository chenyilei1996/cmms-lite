const S = window.SNAPSHOT || null;

const VIEW_META = {
  dashboard: { title: "设备运行总览", eyebrow: "2026年11月25日 · 星期二" },
  notifications: { title: "通知与权限", eyebrow: "NOTIFICATIONS · RBAC" },
  assets: { title: "设备台账", eyebrow: "ASSETS · 128 REGISTERED" },
  "spare-parts": { title: "备件库存", eyebrow: "SPARE PARTS · INVENTORY" },
  "work-orders": { title: "维修工单", eyebrow: "WORK ORDERS · 23 OPEN" },
  maintenance: { title: "保养计划", eyebrow: "PREVENTIVE MAINTENANCE" },
  abnormal: { title: "点检异常记录", eyebrow: "INSPECTION · ABNORMAL LOG" },
  faults: { title: "故障分析", eyebrow: "FAULT ANALYTICS" },
  pdm: { title: "预测性维护", eyebrow: "PREDICTIVE MAINTENANCE" },
  kb: { title: "AI 知识问答", eyebrow: "KNOWLEDGE BASE · AI Q&A" },
  admin: { title: "后台管理", eyebrow: "ADMIN · SYSTEM SETTINGS" },
};

const titleEl = document.getElementById("page-title");
const eyebrowEl = document.getElementById("page-eyebrow");

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function showView(key) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${key}`);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === key);
  });
  const meta = VIEW_META[key];
  if (meta) {
    titleEl.textContent = meta.title;
    eyebrowEl.textContent = meta.eyebrow;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("nav").addEventListener("click", (event) => {
  const item = event.target.closest(".nav-item");
  if (item) showView(item.dataset.view);
});

document.querySelectorAll("[data-go]").forEach((tile) => {
  tile.addEventListener("click", () => showView(tile.dataset.go));
});

/* ---------- 时间格式化（快照时间为 ISO，统一按 Asia/Shanghai 展示） ---------- */
const TIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmt(value, mode = "md-hm") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = {};
  for (const part of TIME_FORMATTER.formatToParts(date)) parts[part.type] = part.value;
  const day = `${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  if (mode === "date") return `${parts.year}-${day}`;
  if (mode === "md") return day;
  if (mode === "hm") return time;
  if (mode === "md-hm") return `${day} ${time}`;
  return `${parts.year}-${day} ${time}`;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setHtml(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.innerHTML = value;
}

/* ---------- 总览 ---------- */
function renderDashboard() {
  if (!S || !S.dashboard) return;
  const { stats, alerts, assetStatus, workOrderProgress } = S.dashboard;

  setText('[data-stat="assets"]', stats.assets);
  setHtml('[data-sub="assets"]', `<b class="text-mint">${stats.running} 台</b> 运行中 · A 类关键 ${stats.criticalA} 台`);
  setText('[data-stat="open-wo"]', stats.openWorkOrders);
  setText('[data-sub="open-wo"]', `${stats.newWorkOrders} 张待派工 · ${stats.inProgressWorkOrders} 张处理中`);
  setText('[data-stat="overdue-plans"]', stats.overduePlans);
  setText('[data-sub="overdue-plans"]', `今日到期 ${stats.dueTodayPlans} 项`);
  setText('[data-stat="repairs30"]', stats.repairs30);
  setText('[data-sub="repairs30"]', `已转工单 ${stats.repairsConverted} 条`);

  setHtml('[data-tile="alarms"]', `${alerts.openAlarms} <small>条</small>`);
  setText('[data-tile-sub="alarms"]', `严重 ${alerts.criticalAlarms} 条 · 需人工确认`);
  setHtml('[data-tile="suggestions"]', `${alerts.pendingSuggestions} <small>条</small>`);
  setText('[data-tile-sub="suggestions"]', alerts.pendingSuggestions ? "由报警生成，确认后转正式工单" : "暂无待确认建议");
  setHtml('[data-tile="abnormal"]', `${alerts.abnormal7} <small>项</small>`);
  setText('[data-tile-sub="abnormal"]', alerts.abnormal7 ? "查看异常测点与处理记录" : "近 7 天暂无异常记录");

  const total = assetStatus.reduce((sum, item) => sum + item.count, 0);
  const activeStatus = assetStatus.filter((item) => item.count > 0);
  setHtml(
    "#asset-dist-bar",
    activeStatus
      .map((item) => `<span style="width:${((item.count / total) * 100).toFixed(1)}%;background:${item.color}"></span>`)
      .join(""),
  );
  setHtml(
    "#asset-dist-legend",
    activeStatus
      .map((item) => `<span><i style="background:${item.color}"></i>${esc(item.label)} ${item.count}</span>`)
      .join(""),
  );
  setText("#asset-dist-label", `ASSETS ${stats.assets}`);
  setText("#asset-dist-foot", `${stats.assets} 台 · 覆盖 ${stats.workshops} 个车间`);

  const progress = workOrderProgress.filter((item) =>
    ["new", "assigned", "in_progress", "pending_acceptance"].includes(item.status),
  );
  const doneCount = workOrderProgress
    .filter((item) => ["completed", "closed"].includes(item.status))
    .reduce((sum, item) => sum + item.count, 0);
  progress.push({ label: "已完成", count: doneCount, status: "done" });
  const maxProgress = Math.max(...progress.map((item) => item.count), 1);
  setHtml(
    "#wo-progress",
    progress
      .map((item) => {
        const color = item.status === "pending_acceptance" ? "#d9a441" : item.status === "done" ? "#4b7a53" : "#2e5a7d";
        return `<div class="bar-row"><span>${esc(item.label)}</span><div class="bar"><i style="width:${((item.count / maxProgress) * 100).toFixed(0)}%;background:${color}"></i></div><em>${item.count}</em></div>`;
      })
      .join(""),
  );
  setText("#wo-progress-label", `OPEN ${stats.openWorkOrders}`);
  const ratio = stats.openWorkOrders ? Math.round((stats.newWorkOrders / stats.openWorkOrders) * 100) : 0;
  setText("#wo-progress-hint", `待派工 ${stats.newWorkOrders} 张，占未关闭工单 ${ratio}%。`);

  setHtml(
    "#recent-orders",
    S.dashboard.recentWorkOrders
      .map(
        (wo) => `<li><span class="mono">${esc(wo.code)}</span><p>${esc(wo.title)}</p><span class="badge ${wo.statusTone}">${esc(wo.statusLabel)}</span><em>${fmt(wo.createdAt)}</em></li>`,
      )
      .join(""),
  );

  setHtml(
    "#due-plans",
    S.dashboard.duePlans
      .map((plan) => {
        const today = fmt(new Date(), "date");
        const dueDay = fmt(plan.nextDueAt, "date");
        const overdue = dueDay < today;
        const isToday = dueDay === today;
        const badge = overdue
          ? '<span class="badge danger">已逾期</span>'
          : isToday
            ? '<span class="badge honey">今日</span>'
            : `<span class="badge neutral">${fmt(plan.nextDueAt, "md")}</span>`;
        return `<li><span class="mono">${esc(plan.assetName)}</span><p>${esc(plan.name)}</p>${badge}<em>${fmt(plan.nextDueAt, "md")}</em></li>`;
      })
      .join(""),
  );
}

/* ---------- 点检异常时间窗 ---------- */
const ABNORMAL_DATA = {
  7: { items: 11, points: 6, repeat: 2, converted: 3, assets: 4 },
  30: { items: 26, points: 11, repeat: 4, converted: 7, assets: 7 },
  90: { items: 68, points: 19, repeat: 6, converted: 16, assets: 9 },
};

const ABNORMAL_STATIC = {
  repeat: [
    { times: 5, asset: "注塑机 A 线", point: "哥林柱润滑", meta: "EQ-001 · 注塑机日检路线 · 已转工单 2 次", value: "缺脂", at: "11-25 09:05" },
    { times: 4, asset: "空压机 1#", point: "排气温度", meta: "EQ-011 · 空压机周检路线 · 已转工单 1 次", value: "98.6 ℃", at: "11-25 08:22" },
  ],
  detail: [
    { asset: "注塑机 A 线", point: "哥林柱润滑", value: "缺脂", std: "均匀油膜", route: "注塑机日检路线", executor: "李强", at: "11-25 09:05" },
    { asset: "空压机 1#", point: "排气温度", value: "98.6 ℃", std: "≤ 90 ℃", route: "空压机周检路线", executor: "王敏", at: "11-25 08:22" },
  ],
};

function renderAbnormalLists(days) {
  if (S && S.abnormal) {
    const from = Date.now() - days * 86400000;
    const items = S.abnormal.items.filter((item) => new Date(item.createdAt).getTime() >= from);
    const grouped = new Map();
    for (const item of items) {
      const key = `${item.assetCode}|${item.pointName}`;
      const entry = grouped.get(key) || { ...item, times: 0, converted: 0 };
      entry.times += 1;
      if (item.workOrderCode) entry.converted += 1;
      grouped.set(key, entry);
    }
    const repeated = [...grouped.values()].filter((item) => item.times >= 2).sort((a, b) => b.times - a.times);
    setText("#abnormal-repeat-label", `REPEATED ${repeated.length}`);
    setHtml(
      "#abnormal-repeat-list",
      repeated.length
        ? repeated
            .map((item) => {
              const standard = item.standardMin !== null && item.standardMax !== null
                ? `${item.standardMin}–${item.standardMax} ${item.unit || ""}`
                : "—";
              return `<li><span class="badge danger">${item.times} 次</span><p><b>${esc(item.assetName)} · ${esc(item.pointName)}</b><em class="mono">${esc(item.assetCode)} · ${esc(item.runName)} · 已转工单 ${item.converted} 次</em></p><div class="right"><b>${esc(item.value ?? "—")}${esc(item.unit || "")}</b><em>${fmt(item.createdAt)}</em></div><span class="sr-only">标准 ${esc(standard)}</span></li>`;
            })
            .join("")
        : '<li><p><b>暂无反复异常测点</b><em>当前时间窗内没有同一测点重复判定异常的记录。</em></p></li>',
    );

    setText("#abnormal-detail-label", `LATEST ${items.length}`);
    setHtml(
      "#abnormal-detail-list",
      items.length
        ? items
            .slice(0, 20)
            .map((item) => {
              const standard = item.standardMin !== null && item.standardMax !== null
                ? `${item.standardMin}–${item.standardMax} ${item.unit || ""}`
                : "—";
              return `<li><span class="badge danger">异常</span><p><b>${esc(item.assetName)} · ${esc(item.pointName)}</b><em>实测 <span class="mono">${esc(item.value ?? "—")}${esc(item.unit || "")}</span> · 标准 ${esc(standard)} · ${esc(item.runName)} · 执行人 ${esc(item.executorName || "—")}</em></p><em class="time">${fmt(item.createdAt)}</em></li>`;
            })
            .join("")
        : '<li><p><b>暂无异常记录</b><em>点检执行记录中没有判定为异常的测点。</em></p></li>',
    );
    return;
  }

  setText("#abnormal-repeat-label", "REPEATED 2");
  setHtml(
    "#abnormal-repeat-list",
    ABNORMAL_STATIC.repeat
      .map(
        (item) => `<li><span class="badge danger">${item.times} 次</span><p><b>${item.asset} · ${item.point}</b><em class="mono">${item.meta}</em></p><div class="right"><b>${item.value}</b><em>${item.at}</em></div></li>`,
      )
      .join(""),
  );
  setText("#abnormal-detail-label", "LATEST 2");
  setHtml(
    "#abnormal-detail-list",
    ABNORMAL_STATIC.detail
      .map(
        (item) => `<li><span class="badge danger">异常</span><p><b>${item.asset} · ${item.point}</b><em>实测 <span class="mono">${item.value}</span> · 标准 ${item.std} · ${item.route} · 执行人 ${item.executor}</em></p><em class="time">${item.at}</em></li>`,
      )
      .join(""),
  );
}

function setAbnormal(days) {
  const data = S && S.abnormal && S.abnormal.totals ? S.abnormal.totals[days] : ABNORMAL_DATA[days];
  const map = {
    items: data.items,
    "items-sub": `近 ${days} 天累计`,
    points: data.points,
    "points-sub": `${data.assets} 台设备`,
    repeat: data.repeat,
    converted: data.converted,
  };
  Object.entries(map).forEach(([key, value]) => {
    const node = document.querySelector(`[data-an="${key}"]`);
    if (node) node.textContent = value;
  });
  document.querySelectorAll("#abnormal-ranges .chip").forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.days) === days);
  });
  renderAbnormalLists(days);
}

document.getElementById("abnormal-ranges").addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (chip) setAbnormal(Number(chip.dataset.days));
});

/* ---------- PDM 趋势与健康分 ---------- */
const SENSORS = [
  { name: "空压机 1# · 排气温度", code: "EQ-011 · TEMP-01", unit: "℃", base: 88, amp: 3.2, drift: 9.5, std: "≤ 90" },
  { name: "冷却塔 · 风机振动", code: "EQ-031 · VIB-01", unit: "mm/s", base: 3.9, amp: 0.5, drift: 1.1, std: "≤ 4.5" },
  { name: "注塑机 A 线 · 液压油温", code: "EQ-001 · TEMP-02", unit: "℃", base: 45, amp: 2.4, drift: 5.2, std: "≤ 55" },
  { name: "冲床 2# · 滑块温度", code: "EQ-021 · TEMP-03", unit: "℃", base: 41, amp: 1.8, drift: 1.4, std: "≤ 60" },
  { name: "注塑机 A 线 · 合模压力", code: "EQ-001 · PRES-01", unit: "bar", base: 128, amp: 5.5, drift: -4, std: "110–140" },
  { name: "公用工程 · 总电流", code: "EQ-041 · CUR-01", unit: "A", base: 210, amp: 12, drift: 8, std: "≤ 260" },
];

const PDM_DATA = {
  1: { health: 82, warning: 1, critical: 0, readings: 65, points: 5, label: "24 小时" },
  7: { health: 70, warning: 3, critical: 0, readings: 438, points: 5, label: "7 天" },
  30: { health: 55, warning: 2, critical: 1, readings: 1876, points: 6, label: "30 天" },
};

function makeSeries(seed, len, base, amp, drift) {
  const out = [];
  for (let i = 0; i < len; i += 1) {
    const ratio = len === 1 ? 0 : i / (len - 1);
    const noise = Math.sin((i + seed) * 1.7) * 0.6 + Math.sin((i + seed) * 0.55) * 0.4;
    out.push(Number((base + drift * ratio + noise * amp).toFixed(1)));
  }
  return out;
}

function sparkline(values, tone) {
  const w = 220;
  const h = 42;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => [
    pad + index * step,
    h - pad - ((value - min) / span) * (h - pad * 2),
  ]);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(pad + (values.length - 1) * step).toFixed(1)},${h} L${pad},${h} Z`;
  const color = tone === "danger" ? "#d71018" : tone === "honey" ? "#d9a441" : "#2e5a7d";
  const fill = tone === "danger" ? "rgba(215,16,24,.08)" : tone === "honey" ? "rgba(217,164,65,.12)" : "rgba(46,90,125,.08)";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${area}" fill="${fill}"></path>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></path>
  </svg>`;
}

function renderSnapshotSensors(days) {
  const html = S.pdm.sensors
    .map((sensor) => {
      const series = days === 1 ? sensor.hourly : sensor.daily;
      const values = series.map((point) => point.v);
      const latest = sensor.latest ? sensor.latest.value : null;
      const exceed = sensor.exceed;
      const tone = exceed ? (latest > sensor.threshold * 1.04 ? "danger" : "honey") : "accent";
      const rangeText = days === 1 ? "24 小时" : `${days} 天`;
      return `<article class="sensor">
        <div class="sensor-top">
          <div><b>${esc(sensor.assetName)} · ${esc(sensor.name)}</b><em>${esc(sensor.assetCode)} · ${esc(sensor.code)}</em></div>
          <span class="badge ${tone === "accent" ? "accent" : tone === "danger" ? "danger" : "honey"}">${exceed ? "超限" : "正常"}</span>
        </div>
        ${values.length > 1 ? sparkline(values, tone) : `<p class="hint" style="padding:10px 0">该时间窗内暂无足够读数</p>`}
        <div class="sensor-bottom">
          <span>近 ${rangeText} · 标准 ${esc(sensor.standard)} · ${series.length} 点</span>
          <b>${latest ?? "—"} ${esc(sensor.unit)}</b>
        </div>
      </article>`;
    })
    .join("");
  document.getElementById("sensors").innerHTML = html;
}

function setSnapshotHealth(days) {
  const latestTs = S.pdm.totals.dataTimestamp ? new Date(S.pdm.totals.dataTimestamp).getTime() : Date.now();
  const from = latestTs - days * 86400000;
  const alarms = S.pdm.alarms.filter(
    (alarm) => !alarm.closed && (!alarm.lastTriggeredAt || new Date(alarm.lastTriggeredAt).getTime() >= from),
  );
  const warning = alarms.filter((alarm) => alarm.severity === "warning").length;
  const critical = alarms.filter((alarm) => alarm.severity === "critical").length;
  const health = Math.max(0, 100 - warning * 10 - critical * 25);
  const scoreEl = document.getElementById("health-score");
  const labelEl = document.getElementById("health-label");
  const descEl = document.getElementById("health-desc");
  scoreEl.querySelector("span").textContent = health;
  const tone =
    health >= 85 ? { text: "#184120", bg: "#e3e9e1", ring: "rgba(24,65,32,.12)" }
      : health >= 60 ? { text: "#a84a0c", bg: "#fbeee4", ring: "rgba(168,74,12,.12)" }
        : { text: "#d71018", bg: "#fae9e7", ring: "rgba(215,16,24,.14)" };
  scoreEl.style.background = tone.bg;
  scoreEl.style.boxShadow = `inset 0 0 0 1px ${tone.ring}`;
  scoreEl.querySelector("span").style.color = tone.text;
  labelEl.textContent = `· ${health >= 85 ? "状态良好" : health >= 60 ? "需要关注" : "建议尽快检修"}`;
  labelEl.style.color = tone.text;
  const label = days === 1 ? "24 小时" : `${days} 天`;
  descEl.textContent = `近 ${label}内按报警等级扣分：预警 −10、严重 −25，满分 100。当前预警 ${warning} 次、严重 ${critical} 次。`;
  const readings = days === 1
    ? S.pdm.sensors.reduce((sum, sensor) => sum + (sensor.hourly || []).reduce((n, point) => n + point.n, 0), 0)
    : S.pdm.totals.readings;
  document.getElementById("reading-count").textContent = readings.toLocaleString("zh-CN");
  document.getElementById("trend-label").textContent = days === 1 ? "LATEST 24H" : `LATEST ${days}D`;
  renderSnapshotSensors(days);
  document.querySelectorAll("#pdm-ranges .chip").forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.days) === days);
  });
}

function renderSensors(days) {
  if (S && S.pdm) {
    renderSnapshotSensors(days);
    return;
  }
  const len = days === 1 ? 24 : days;
  const html = SENSORS.map((sensor, index) => {
    const values = makeSeries(index * 3 + 1, len, sensor.base, sensor.amp, sensor.drift);
    const latest = values[values.length - 1];
    const limit = Number((sensor.std.match(/[\d.]+/) || [0])[0]);
    const exceed = /≤/.test(sensor.std) ? latest > limit : false;
    const tone = exceed ? (latest > limit * 1.04 ? "danger" : "honey") : "accent";
    const rangeText = days === 1 ? "24 小时" : `${days} 天`;
    return `<article class="sensor">
      <div class="sensor-top">
        <div><b>${sensor.name}</b><em>${sensor.code}</em></div>
        <span class="badge ${tone === "accent" ? "accent" : tone === "danger" ? "danger" : "honey"}">${exceed ? "超限" : "正常"}</span>
      </div>
      ${sparkline(values, tone)}
      <div class="sensor-bottom">
        <span>近 ${rangeText} · 标准 ${sensor.std}</span>
        <b>${latest} ${sensor.unit}</b>
      </div>
    </article>`;
  }).join("");
  document.getElementById("sensors").innerHTML = html;
}

function setHealth(days) {
  if (S && S.pdm) {
    setSnapshotHealth(days);
    return;
  }
  const data = PDM_DATA[days];
  const scoreEl = document.getElementById("health-score");
  const labelEl = document.getElementById("health-label");
  const descEl = document.getElementById("health-desc");
  scoreEl.querySelector("span").textContent = data.health;
  const tone =
    data.health >= 85 ? { text: "#184120", bg: "#e3e9e1", ring: "rgba(24,65,32,.12)" }
      : data.health >= 60 ? { text: "#a84a0c", bg: "#fbeee4", ring: "rgba(168,74,12,.12)" }
        : { text: "#d71018", bg: "#fae9e7", ring: "rgba(215,16,24,.14)" };
  scoreEl.style.background = tone.bg;
  scoreEl.style.boxShadow = `inset 0 0 0 1px ${tone.ring}`;
  scoreEl.querySelector("span").style.color = tone.text;
  labelEl.textContent = `· ${data.health >= 85 ? "状态良好" : data.health >= 60 ? "需要关注" : "建议尽快检修"}`;
  labelEl.style.color = tone.text;
  descEl.textContent = `近 ${data.label}内按报警等级扣分：预警 −10、严重 −25，满分 100。当前预警 ${data.warning} 次、严重 ${data.critical} 次。`;
  document.getElementById("reading-count").textContent = data.readings.toLocaleString("zh-CN");
  document.getElementById("trend-label").textContent = days === 1 ? "LATEST 24H" : `LATEST ${days}D`;
  renderSensors(days);
  document.querySelectorAll("#pdm-ranges .chip").forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.days) === days);
  });
}

document.getElementById("pdm-ranges").addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (chip) setHealth(Number(chip.dataset.days));
});

function renderPdmBlock() {
  if (!S || !S.pdm) return;
  const totals = S.pdm.totals;
  setText('[data-pdm="sensors"]', totals.sensors);
  setText('[data-pdm-sub="sensors"]', `${totals.activeRules} 条启用规则`);
  setText('[data-pdm="alarms"]', totals.openAlarms);
  setText('[data-pdm-sub="alarms"]', `严重 ${totals.criticalAlarms} 条`);
  setText('[data-pdm="suggestions"]', totals.pendingSuggestions);
  const converted = S.pdm.suggestions.filter((item) => item.status === "converted").length;
  setText('[data-pdm-sub="suggestions"]', `已转工单 ${converted} 条`);
  setText("#pdm-alarm-label", `ALARMS ${S.pdm.alarms.length}`);
  setHtml(
    "#pdm-alarms",
    S.pdm.alarms.length
      ? S.pdm.alarms
          .map((alarm) => {
            const tone = alarm.closed ? "mint" : alarm.severity === "critical" ? "danger" : "honey";
            const statusText = alarm.closed ? "已转工单" : alarm.severityLabel;
            return `<li><span class="badge ${tone}">${esc(statusText)}</span><p><b>${esc(alarm.assetName)} · ${esc(alarm.sensorName)}${alarm.value !== null ? ` ${alarm.value} ${esc(alarm.sensorUnit)}` : ""}</b><em>${esc(alarm.ruleName)} · 触发 ${alarm.occurrences} 次${alarm.closed ? " · 已处理" : ""}</em></p><em class="time">${fmt(alarm.lastTriggeredAt)}</em></li>`;
          })
          .join("")
      : '<li><p><b>暂无报警</b><em>当前所有 PDM 测点均在阈值范围内。</em></p></li>',
  );
}

/* ---------- AI 问答模拟 ---------- */
const CANNED = {
  work: {
    answer: [
      "安全提示：进入设备运动区域前先执行上锁挂牌（断电、泄压、上锁、挂牌、验证零能量），不要只按急停。",
      "1. 先查哥林柱润滑：清洁表面后补注专用润滑脂。<br />2. 再测铜套间隙：塞尺测量，超厂家上限即更换铜套，不能只补脂不测间隙。<br />3. 低速空载合模 20 次，复测振动与异响。<br />4. 若仍异响，检查模板平行度与拉杆螺母松动。",
    ],
    sources: ["1 注塑机合模异响与哥林柱铜套润滑检查", "2 维修前上锁挂牌（LOTO）安全要求"],
    meta: "deepseek-chat · 耗时 6.4s · 回答由模型基于知识库生成，请结合现场判断",
  },
  kb: {
    answer: [
      "安全提示：进入设备运动区域前先执行上锁挂牌，不要只按急停不隔离能源。",
      "1. 先查哥林柱润滑，清洁后补注专用润滑脂。<br />2. 用塞尺测铜套间隙，超过厂家上限即更换。<br />3. 低速空载合模 20 次，复测振动与异响。",
    ],
    sources: ["1 注塑机合模异响与哥林柱铜套润滑检查", "2 维修前上锁挂牌（LOTO）安全要求"],
    meta: "deepseek-chat · 耗时 5.9s · 回答由模型基于知识库生成，请结合现场判断",
  },
};

function wireAsk(inputId, buttonId, suggestId, answerId, canned) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  const answer = document.getElementById(answerId);
  let busy = false;

  function ask(text) {
    const question = (text ?? input.value).trim();
    if (question.length < 2 || busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = "生成中";
    answer.innerHTML = `<p class="q">问：${esc(question)}</p>
      <p class="a">正在检索知识库并请求模型，通常需要 5–20 秒…</p>`;
    window.setTimeout(() => {
      answer.innerHTML = `<p class="q">问：${esc(question)}</p>
        ${canned.answer.map((paragraph) => `<p class="a">${paragraph}</p>`).join("")}
        <div class="sources">${canned.sources.map((source) => `<span class="src">${esc(source)}</span>`).join("")}</div>
        <p class="meta">${canned.meta}</p>`;
      button.disabled = false;
      button.textContent = "提问";
      busy = false;
    }, 1100);
  }

  button.addEventListener("click", () => ask());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") ask();
  });
  const suggest = document.getElementById(suggestId);
  if (suggest) {
    suggest.addEventListener("click", (event) => {
      const chip = event.target.closest("button");
      if (!chip) return;
      input.value = chip.textContent.trim();
      ask(chip.textContent.trim());
    });
  }
}

wireAsk("qa-input", "qa-btn", "qa-suggest", "qa-answer", CANNED.work);
wireAsk("kb-input", "kb-btn", "kb-suggest", "kb-answer", CANNED.kb);

/* ---------- 设备台账 ---------- */
const STATIC_ASSETS = [
  { id: "EQ-001", name: "注塑机 A 线", workshop: "注塑车间", area: "注塑一线", status: "运行中", tone: "mint", grade: "A 类", owner: "李强", since: "2021-06", lastCheck: "11-25 09:05", wo: 1, pdm: "液压油温 45 ℃", note: "合模异响工单处理中", category: "注塑机" },
  { id: "EQ-011", name: "空压机 1#", workshop: "公用工程", area: "空压站", status: "故障", tone: "danger", grade: "A 类", owner: "王敏", since: "2019-03", lastCheck: "11-25 08:22", wo: 2, pdm: "排气温度 98.6 ℃", note: "PDM 严重报警，已生成建议工单", category: "空压机" },
  { id: "EQ-021", name: "冲床 2#", workshop: "冲压车间", area: "冲压二线", status: "运行中", tone: "mint", grade: "A 类", owner: "赵磊", since: "2020-09", lastCheck: "11-24 15:41", wo: 0, pdm: "滑块温度 41 ℃", note: "润滑保养已完成", category: "冲床" },
  { id: "EQ-031", name: "冷却塔", workshop: "公用工程", area: "循环水站", status: "保养中", tone: "honey", grade: "B 类", owner: "张伟", since: "2018-11", lastCheck: "11-24 10:18", wo: 1, pdm: "风机振动 4.8 mm/s", note: "月度保养完成，观察振动趋势", category: "冷却塔" },
  { id: "EQ-041", name: "包装线", workshop: "包装车间", area: "包装一线", status: "运行中", tone: "mint", grade: "B 类", owner: "陈晨", since: "2022-04", lastCheck: "11-23 17:02", wo: 0, pdm: "总电流 210 A", note: "光电传感器已更换", category: "包装线" },
  { id: "EQ-051", name: "行车 3#", workshop: "冲压车间", area: "模具区", status: "停用", tone: "neutral", grade: "C 类", owner: "赵磊", since: "2017-08", lastCheck: "11-20 08:00", wo: 0, pdm: "未接入测点", note: "钢丝绳检查逾期，暂停使用", category: "行车" },
];

const ASSETS = S && S.assets
  ? S.assets.map((asset) => ({
      id: asset.code,
      name: asset.name,
      workshop: asset.workshop || "—",
      area: asset.installLocation || asset.location || asset.levelLabel || "—",
      status: asset.statusLabel,
      tone: asset.statusTone,
      grade: asset.criticality ? `${asset.criticality} 类` : asset.levelLabel,
      owner: asset.owner || "—",
      since: asset.purchaseMonth || "—",
      lastCheck: fmt(asset.lastCheckAt),
      wo: asset.openWorkOrders,
      pdm: asset.pdmLatest ? `${asset.pdmLatest.name} ${asset.pdmLatest.value} ${asset.pdmLatest.unit}` : "未接入测点",
      note: asset.notes || "",
      category: asset.category || asset.levelLabel,
      raw: asset,
    }))
  : STATIC_ASSETS;

let assetFilter = "all";

function qrHtml(seed) {
  let cells = "";
  for (let i = 0; i < 49; i += 1) {
    const on = (i * 7 + seed * 13 + (i % 3)) % 5 < 2;
    cells += `<i class="${on ? "" : "blank"}"></i>`;
  }
  return `<div class="qr" aria-hidden="true">${cells}</div>`;
}

function renderAssetFilters() {
  if (!S || !S.assets) return;
  const defs = [
    { key: "all", label: "全部" },
    { key: "in_service", label: "运行中" },
    { key: "fault", label: "故障" },
    { key: "maintenance", label: "保养" },
    { key: "repairing", label: "维修" },
    { key: "idle", label: "待机" },
  ];
  document.getElementById("asset-filters").innerHTML = defs
    .map((def) => {
      const count = def.key === "all" ? ASSETS.length : ASSETS.filter((asset) => asset.raw.status === def.key).length;
      return `<button class="chip ${assetFilter === def.key ? "active" : ""}" data-filter="${def.key}">${def.label} ${count}</button>`;
    })
    .join("") + '<span class="hint" style="margin-left:auto">一机一码 · 扫码即可报修 / 点检</span>';
  document.querySelectorAll("#asset-filters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      assetFilter = chip.dataset.filter;
      renderAssetFilters();
      renderAssets(selectedAssetId);
    });
  });
}

let selectedAssetId = ASSETS[0] ? ASSETS[0].id : "EQ-001";

function assetTimeline(asset) {
  const raw = asset.raw || {};
  const events = [];
  if (raw.lastCheckAt) events.push({ label: `点检完成：${asset.lastCheck}`, at: fmt(raw.lastCheckAt) });
  const wo = S && S.workOrders ? S.workOrders.find((item) => item.assetCode === asset.id) : null;
  if (wo) events.push({ label: `工单 ${wo.code}：${wo.title}`, at: fmt(wo.createdAt) });
  const plan = S && S.maintenance ? S.maintenance.plans.find((item) => item.assetCode === asset.id) : null;
  if (plan) events.push({ label: `保养计划：${plan.name}`, at: `下次 ${fmt(plan.nextDueAt)}` });
  if (asset.note) events.push({ label: `台账备注：${asset.note}`, at: raw.criticality ? `${asset.grade}` : "—" });
  return events
    .map((event) => `<li><span>${esc(event.label)}</span><em>${esc(event.at)}</em></li>`)
    .join("");
}

function renderAssets(selectedId) {
  const current = ASSETS.find((asset) => asset.id === selectedId) ?? ASSETS[0];
  selectedAssetId = current.id;
  const list = assetFilter === "all"
    ? ASSETS
    : ASSETS.filter((asset) => (asset.raw ? asset.raw.status : "in_service") === assetFilter);
  document.getElementById("asset-list").innerHTML = list.length
    ? list
        .map(
          (asset) => `<li class="${asset.id === current.id ? "selected" : ""}" data-asset="${esc(asset.id)}">
      <span class="mono">${esc(asset.id)}</span>
      <p><b>${esc(asset.name)}</b><em>${esc(asset.workshop)} · ${esc(asset.area)} · ${esc(asset.grade)}</em></p>
      <span class="badge ${asset.tone}">${esc(asset.status)}</span>
    </li>`,
        )
        .join("")
    : '<li><p><b>该状态下暂无设备</b><em>切换筛选查看其他设备。</em></p></li>';
  setText("#asset-list-label", `${list.length} ASSETS`);
  if (S && S.assets) {
    setText('[data-asset-stat="total"]', S.assets.length);
    setText('[data-asset-sub="total"]', `覆盖 ${new Set(S.assets.map((asset) => asset.workshop).filter(Boolean)).size} 个车间`);
    setText('[data-asset-stat="critical"]', S.assets.filter((asset) => asset.criticality === "A").length);
    setText('[data-asset-sub="critical"]', "重点巡检与备件保障");
    const now = new Date();
    const month = fmt(now, "date").slice(0, 7);
    setText('[data-asset-stat="new"]', S.assets.filter((asset) => fmt(asset.purchaseAt, "date").startsWith(month)).length);
    setText('[data-asset-sub="new"]', "按建档 / 投产月份统计");
    const stopped = S.assets.filter((asset) => asset.status === "stopped").length;
    const retired = S.assets.filter((asset) => asset.status === "retired").length;
    setText('[data-asset-stat="inactive"]', stopped + retired);
    setText('[data-asset-sub="inactive"]', `停用 ${stopped} · 报废 ${retired}`);
  }

  document.getElementById("asset-detail").innerHTML = `
    <div class="asset-detail-head">
      ${qrHtml(ASSETS.indexOf(current) + 1)}
      <div>
        <p class="label-mono">${esc(current.id)} · ${esc(current.category || current.grade)}</p>
        <h2>${esc(current.name)}</h2>
        <p class="hint">${esc(current.workshop)} · ${esc(current.area)} · 责任人 ${esc(current.owner)}</p>
        <div style="margin-top:8px"><span class="badge ${current.tone}">${esc(current.status)}</span></div>
      </div>
    </div>
    <div class="asset-kv">
      <div><p class="k">设备编号</p><p class="v mono">${esc(current.id)}</p></div>
      <div><p class="k">投产时间</p><p class="v">${esc(current.since)}</p></div>
      <div><p class="k">安装位置</p><p class="v">${esc(current.workshop)} · ${esc(current.area)}</p></div>
      <div><p class="k">未关闭工单</p><p class="v">${current.wo} 张</p></div>
      <div><p class="k">最近点检</p><p class="v">${esc(current.lastCheck)}</p></div>
      <div><p class="k">PDM 最新读数</p><p class="v">${esc(current.pdm)}</p></div>
    </div>
    <ul class="timeline">${assetTimeline(current)}</ul>`;

  document.querySelectorAll("#asset-list li[data-asset]").forEach((item) => {
    item.addEventListener("click", () => renderAssets(item.dataset.asset));
  });
}

renderAssetFilters();
renderAssets(selectedAssetId);

/* ---------- 工单 ---------- */
const WO_FILTERS = [
  { key: "all", label: "全部" },
  { key: "new", label: "待派工" },
  { key: "assigned", label: "已派工" },
  { key: "in_progress", label: "处理中" },
  { key: "pending_acceptance", label: "待验收" },
  { key: "closed", label: "已完成" },
];

let woFilter = "all";
let selectedWoCode = S && S.workOrders && S.workOrders[0] ? S.workOrders[0].code : "WO-2026-0187";

function renderWorkOrderFilters() {
  if (!S || !S.workOrders) return;
  document.getElementById("wo-filters").innerHTML = WO_FILTERS.map((def) => {
    const count = def.key === "all"
      ? S.workOrders.length
      : def.key === "closed"
        ? S.workOrders.filter((wo) => ["completed", "closed"].includes(wo.status)).length
        : S.workOrders.filter((wo) => wo.status === def.key).length;
    return `<button class="chip ${woFilter === def.key ? "active" : ""}" data-filter="${def.key}">${def.label} ${count}</button>`;
  }).join("");
  document.querySelectorAll("#wo-filters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      woFilter = chip.dataset.filter;
      renderWorkOrderFilters();
      renderWorkOrderList();
    });
  });
}

function renderWorkOrderList() {
  if (!S || !S.workOrders) return;
  const list = woFilter === "all"
    ? S.workOrders
    : woFilter === "closed"
      ? S.workOrders.filter((wo) => ["completed", "closed"].includes(wo.status))
      : S.workOrders.filter((wo) => wo.status === woFilter);
  const selected = list.find((wo) => wo.code === selectedWoCode) || list[0];
  if (selected) selectedWoCode = selected.code;
  document.getElementById("wo-list").innerHTML = list.length
    ? list
        .map(
          (wo) => `<li class="${wo.code === selectedWoCode ? "selected" : ""}" data-wo="${esc(wo.code)}"><span class="mono">${esc(wo.code)}</span><p>${esc(wo.title)}</p><span class="badge ${wo.statusTone}">${esc(wo.statusLabel)}</span></li>`,
        )
        .join("")
    : '<li><p><b>该状态下暂无工单</b><em>切换筛选查看其他工单。</em></p></li>';
  setText("#wo-list-label", `${selectedWoCode} SELECTED`);
  document.querySelectorAll("#wo-list li[data-wo]").forEach((item) => {
    item.addEventListener("click", () => {
      selectedWoCode = item.dataset.wo;
      renderWorkOrderList();
      renderWorkOrderDetail();
    });
  });
}

function renderWorkOrderDetail() {
  if (!S || !S.workOrders) return;
  const wo = S.workOrders.find((item) => item.code === selectedWoCode) || S.workOrders[0];
  if (!wo) return;
  selectedWoCode = wo.code;
  const parts = wo.parts && wo.parts.length
    ? `；备件：${wo.parts.map((part) => `${part.name} × ${part.qty}`).join("、")}`
    : "";
  const description = wo.description || wo.faultPhenomenon || "暂无报修描述";
  document.getElementById("wo-detail-card").innerHTML = `
    <div class="wo-head">
      <div>
        <p class="label-mono">${esc(wo.code)} · ${esc(wo.assetCode)}</p>
        <h2>${esc(wo.title)}</h2>
        <p class="hint">${esc(wo.assetName)} · 创建于 ${fmt(wo.createdAt)}</p>
      </div>
      <span class="badge ${wo.statusTone}">${esc(wo.statusLabel)}</span>
    </div>
    <div class="kv-grid">
      <div><p class="k">故障现象</p><p class="v">${esc(wo.faultPhenomenon || "—")}</p></div>
      <div><p class="k">故障代码</p><p class="v">${esc(wo.faultCode || "—")}${wo.faultName ? ` ${esc(wo.faultName)}` : ""}</p></div>
      <div><p class="k">负责人</p><p class="v">${esc(wo.assignee || "未派工")}</p></div>
      <div><p class="k">停机</p><p class="v">${wo.downtimeMinutes ? `${wo.downtimeMinutes} 分钟` : "—"}</p></div>
    </div>
    <div class="note-box">
      <p class="k">报修描述</p>
      <p>${esc(description)}${esc(parts)}</p>
    </div>`;
  const ctx = document.getElementById("wo-ai-ctx");
  if (ctx) {
    ctx.textContent = `上下文：${wo.assetName}（${wo.assetCode}）｜故障代码 ${wo.faultCode || "—"}｜故障现象：${wo.faultPhenomenon || wo.title}`;
  }
}

renderWorkOrderFilters();
renderWorkOrderList();
renderWorkOrderDetail();

/* ---------- 备件 ---------- */
function latestTxn(partCode) {
  if (!S || !S.spareParts) return null;
  return S.spareParts.transactions.find((txn) => txn.partCode === partCode) || null;
}

function renderSpareParts() {
  if (!S || !S.spareParts) return;
  const { stats, parts, transactions, lowStock } = S.spareParts;
  setText('[data-spare="kinds"]', stats.kinds);
  setText('[data-spare-sub="kinds"]', `在用 ${stats.active} · 停用 ${stats.kinds - stats.active}`);
  setText('[data-spare="low"]', stats.lowStock);
  setText('[data-spare-sub="low"]', "低于安全库存");
  setText('[data-spare="out"]', stats.outThisMonth);
  setText('[data-spare-sub="out"]', `本月入库 ${stats.inThisMonth}`);
  setText('[data-spare="value"]', `¥${stats.stockValue.toLocaleString("zh-CN")}`);
  setText('[data-spare-sub="value"]', "按参考价估算");
  setText("#parts-label", `${parts.length} SPARE PARTS`);

  const lowText = document.getElementById("low-stock-text");
  if (lowText) {
    lowText.innerHTML = lowStock.length
      ? `<b>${lowStock.length} 种备件</b> 低于安全库存，建议补货：${lowStock.map((part) => esc(part.name)).join("、")}。`
      : "<b>库存正常</b> 当前没有低于安全库存的备件。";
  }

  document.getElementById("parts-tbody").innerHTML = parts
    .map((part) => {
      const low = part.stockQty < part.safetyStock;
      const near = !low && part.stockQty <= part.safetyStock * 1.05;
      const cls = low ? "text-danger" : near ? "text-honey" : "";
      const txn = latestTxn(part.code);
      const txnText = txn
        ? `${fmt(txn.createdAt, "md")} ${txn.type === "out" ? "出库" : txn.type === "in" ? "入库" : esc(txn.type)} ${txn.quantity}`
        : "—";
      return `<tr><td class="mono">${esc(part.code)}</td><td>${esc(part.name)}</td><td>${esc(part.spec || "—")}</td><td><b class="${cls}">${part.stockQty} / ${part.safetyStock}</b></td><td>${esc(part.binCode || "—")}</td><td>${txnText}</td></tr>`;
    })
    .join("");

  setText("#part-txn-label", `LATEST ${transactions.length}`);
  setHtml(
    "#part-txns",
    transactions.length
      ? transactions
          .map((txn) => {
            const out = txn.type === "out" || txn.type === "adjust";
            const detail = [txn.workOrderCode ? `工单 ${txn.workOrderCode}` : "", txn.assetName, txn.operatorName ? `经手 ${txn.operatorName}` : "", txn.note].filter(Boolean).join(" · ");
            return `<li><span class="badge ${out ? "danger" : "mint"}">${out ? "出库" : "入库"}</span><p><b>${esc(txn.partName)} × ${txn.quantity}</b><em>${esc(detail || "—")}</em></p><em class="time">${fmt(txn.createdAt)}</em></li>`;
          })
          .join("")
      : '<li><p><b>暂无出入库流水</b><em>领用或入库后会自动记录。</em></p></li>',
  );
}

/* ---------- 保养 ---------- */
function renderMaintenance() {
  if (!S || !S.maintenance) return;
  const { stats, plans, tasks } = S.maintenance;
  setText('[data-maint="monthly"]', stats.monthlyPlans);
  setText('[data-maint-sub="monthly"]', "本月到期计划");
  setText('[data-maint="done"]', stats.doneTasks);
  setText('[data-maint-sub="done"]', "点检 / 保养任务");
  setText('[data-maint="overdue"]', stats.overduePlans);
  setText('[data-maint-sub="overdue"]', "计划到期未完成");
  setText('[data-maint="today"]', stats.dueTodayPlans);
  setText('[data-maint-sub="today"]', "计划到期日");
  setText("#plan-label", `${plans.length} PREVENTIVE`);

  const today = fmt(new Date(), "date");
  setHtml(
    "#plan-list",
    plans.length
      ? plans
          .map((plan) => {
            const dueDay = fmt(plan.nextDueAt, "date");
            const overdue = dueDay < today;
            const isToday = dueDay === today;
            const badge = overdue
              ? '<span class="badge danger">已逾期</span>'
              : isToday
                ? '<span class="badge honey">今日到期</span>'
                : `<span class="badge neutral">${fmt(plan.nextDueAt, "md")}</span>`;
            const right = overdue ? `逾期 ${Math.ceil((new Date(today) - new Date(dueDay)) / 86400000)} 天` : isToday ? "待执行" : "待提醒";
            return `<li>${badge}<p><b>${esc(plan.assetName)} · ${esc(plan.name)}</b><em class="mono">${esc(plan.assetCode)} · 每 ${plan.cycleDays} 天 · 负责人 ${esc(plan.assignee || "—")}</em></p><div class="right"><b>${right}</b><em>${esc(plan.templateName)}</em></div></li>`;
          })
          .join("")
      : '<li><p><b>暂无保养计划</b><em>可在设备详情中创建周期计划。</em></p></li>',
  );

  const done = tasks.filter((task) => task.status === "done" || task.status === "skipped");
  setText("#pm-record-label", `DONE ${done.length}`);
  setHtml(
    "#pm-records",
    done.length
      ? done
          .map((task) => {
            const tone = task.status === "done" ? "mint" : "honey";
            return `<li><span class="badge ${tone}">${esc(task.statusLabel)}</span><p><b>${esc(task.assetName)} · ${esc(task.planName)}</b><em>${esc(task.templateName)}${task.executorName ? ` · 执行人 ${esc(task.executorName)}` : ""}${task.note ? ` · ${esc(task.note)}` : ""}</em></p><em class="time">${fmt(task.completedAt || task.dueAt)}</em></li>`;
          })
          .join("")
      : '<li><p><b>暂无执行记录</b><em>保养任务执行后会出现在这里。</em></p></li>',
  );
}

/* ---------- 故障分析 ---------- */
function renderFaults() {
  if (!S || !S.faults) return;
  const { stats, monthlyTrend, typeTop, downtimeTop } = S.faults;
  setText('[data-fault="count"]', stats.faults);
  setText('[data-fault-sub="count"]', `${stats.totalDowntime} 分钟累计停机`);
  setHtml('[data-fault="avg"]', `${stats.avgDowntime}<small style="font-size:12px"> 分钟</small>`);
  setText('[data-fault-sub="avg"]', "单次非计划停机");
  setHtml('[data-fault="mttr"]', `${stats.mttrHours}<small style="font-size:12px"> h</small>`);
  setText('[data-fault-sub="mttr"]', "平均修复时长");
  setHtml('[data-fault="rate"]', `${stats.faultRate}<small style="font-size:12px">%</small>`);
  setText('[data-fault-sub="rate"]', `${stats.affectedAssets} / ${stats.machineAssets} 台机器设备`);

  const maxMonth = Math.max(...monthlyTrend.map((item) => item.count), 1);
  setHtml(
    "#fault-trend",
    monthlyTrend
      .map((item) => `<div class="col"><i style="height:${item.count ? Math.max((item.count / maxMonth) * 100, 2) : 0}%"></i><span>${esc(item.label)}</span><em>${item.count}</em></div>`)
      .join(""),
  );
  setText("#fault-trend-hint", `按故障 / 纠正类工单创建月份统计，近 6 个月共 ${monthlyTrend.reduce((sum, item) => sum + item.count, 0)} 张。`);

  const maxType = typeTop.length ? typeTop[0].count : 1;
  const colors = ["#d71018", "#d9a441", "#2e5a7d", "#4b7a53", "#77736a"];
  setHtml(
    "#fault-types",
    typeTop.length
      ? typeTop
          .map((item, index) => `<div class="bar-row"><span>${esc(item.name)}</span><div class="bar"><i style="width:${((item.count / maxType) * 100).toFixed(0)}%;background:${colors[index % colors.length]}"></i></div><em>${item.count}</em></div>`)
          .join("")
      : '<p class="hint">暂无已分类故障。</p>',
  );
  setText("#fault-type-hint", typeTop.length ? "按工单故障代码分类统计。" : "暂无已分类故障工单。");

  setHtml(
    "#fault-downtime",
    downtimeTop.length
      ? downtimeTop
          .map((item) => {
            const asset = S.assets.find((row) => row.code === item.assetCode);
            const hours = (item.minutes / 60).toFixed(1);
            return `<li><span class="badge ${item.unplanned > 0 ? "danger" : "honey"}">${hours}h</span><p><b>${esc(item.assetName)}</b><em class="mono">${esc(item.assetCode)} · ${item.count} 次停机 · ${item.unplanned} 次非计划</em></p><div class="right"><b>${esc(asset ? `${asset.criticality || "—"} 类` : "—")}</b><em>${esc(asset ? asset.workshop : "—")}</em></div></li>`;
          })
          .join("")
      : '<li><p><b>暂无停机记录</b><em>work_orders / downtime_records 中没有停机数据。</em></p></li>',
  );
}

/* ---------- 通知 ---------- */
function renderNotifications() {
  if (!S || !S.notifications) return;
  const { items, unread } = S.notifications;
  setText("#notice-unread-label", `UNREAD ${unread}`);
  setHtml(
    "#notice-list",
    items.length
      ? items
          .map(
            (item) => `<li class="${item.read ? "" : "unread"}">${item.read ? "" : '<span class="dot-red"></span>'}<p><b>${esc(item.title)}</b><em>${esc(item.body)}${item.userName ? ` · ${esc(item.userName)}` : ""}</em></p><em class="time">${fmt(item.createdAt)}</em></li>`,
          )
          .join("")
      : '<li><p><b>暂无通知</b><em>系统消息会显示在这里。</em></p></li>',
  );
}

/* ---------- 知识库 ---------- */
function renderKb() {
  if (!S || !S.kb) return;
  const { categories, articles } = S.kb;
  setHtml(
    "#kb-cats",
    categories.map((cat) => `<li><span>${esc(cat.label)}</span><em>${cat.count}</em></li>`).join(""),
  );
  const sources = [...articles]
    .filter((article) => article.status === "published")
    .sort((a, b) => b.helpfulCount - a.helpfulCount)
    .slice(0, 3);
  setHtml(
    "#kb-sources",
    sources.length
      ? sources
          .map(
            (article) => `<li><span class="mono">${esc(article.code)}</span><p>${esc(article.title)}</p><em>${article.helpfulCount} 人觉得有帮助</em></li>`,
          )
          .join("")
      : '<li><p><b>暂无文章</b><em>工单关闭后可沉淀为知识。</em></p></li>',
  );
}

/* ---------- 后台用户与角色 ---------- */
function renderAdmin() {
  if (!S || !S.users || !S.roles) return;
  const active = S.users.filter((user) => user.active).length;
  const builtin = S.roles.filter((role) => role.builtin).length;
  const month = fmt(new Date(), "date").slice(0, 7);
  const newUsers = S.users.filter((user) => fmt(user.createdAt, "date").startsWith(month)).length;
  setText('[data-admin="users"]', S.users.length);
  setText('[data-admin-sub="users"]', `在用 ${active} · 停用 ${S.users.length - active}`);
  setText('[data-admin="roles"]', S.roles.length);
  setText('[data-admin-sub="roles"]', `${builtin} 个内置 + ${S.roles.length - builtin} 个自定义`);
  setText('[data-admin="new"]', newUsers);
  setText('[data-admin-sub="new"]', "按创建时间统计");
  setText("#role-label", `ROLES ${S.roles.length}`);
  setText("#user-label", `USERS ${S.users.length}`);

  const abilityLabels = { manage: "manage", repair: "repair", admin: "admin" };
  setHtml(
    "#role-grid",
    S.roles
      .map((role) => {
        const chips = role.abilities.length
          ? role.abilities.map((ability) => `<span class="chip">${esc(abilityLabels[ability] || ability)}</span>`).join("")
          : '<span class="chip">只读</span>';
        return `<article class="role-card"><div class="role-top"><b>${esc(role.name)}</b><span class="badge ${role.builtin ? "accent" : "mint"}">${role.builtin ? "内置" : "自定义"}</span></div><p class="hint">${esc(role.description || "")}</p><div class="chips">${chips}</div></article>`;
      })
      .join(""),
  );

  setHtml(
    "#admin-users",
    S.users
      .map((user) => {
        const role = S.roles.find((item) => item.id === user.role);
        return `<tr><td>${esc(user.name)}</td><td class="mono">${esc(user.emailPrefix)}</td><td>${esc(role ? role.name : user.role)}</td><td><span class="badge ${user.active ? "mint" : "neutral"}">${user.active ? "启用" : "停用"}</span></td><td>${fmt(user.lastLoginAt)}</td></tr>`;
      })
      .join(""),
  );

  const workshops = new Map();
  for (const asset of S.assets) {
    const key = asset.workshop || "未分配车间";
    const entry = workshops.get(key) || { total: 0, lines: new Set() };
    if (asset.level === "machine") entry.total += 1;
    if (asset.level === "line") entry.lines.add(asset.name);
    workshops.set(key, entry);
  }
  setHtml(
    "#category-tree",
    [...workshops.entries()]
      .map(([name, entry]) => `<li><b>${esc(name)}</b><em>${entry.total} 台</em><span>${entry.lines.size ? [...entry.lines].map((line) => esc(line)).join(" · ") : "未建产线层级"}</span></li>`)
      .join(""),
  );
  const types = new Map();
  for (const asset of S.assets) {
    if (asset.level !== "machine") continue;
    const key = asset.category || "未分类";
    types.set(key, (types.get(key) || 0) + 1);
  }
  setHtml(
    "#category-types",
    [...types.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `<span class="chip">${esc(name)} ${count}</span>`)
      .join(""),
  );
}

/* ---------- 页脚与导航计数 ---------- */
function renderMeta() {
  if (!S || !S.meta) return;
  const stamp = document.getElementById("snapshot-stamp");
  if (stamp) stamp.textContent = `数据快照：${S.meta.generatedAt} · 来自真实库`;
  VIEW_META.assets.eyebrow = `ASSETS · ${S.meta.counts.assets} REGISTERED`;
  const open = (S.dashboard && S.dashboard.stats.openWorkOrders) || 0;
  VIEW_META["work-orders"].eyebrow = `WORK ORDERS · ${open} OPEN`;
  if (document.getElementById("view-assets").classList.contains("active")) {
    eyebrowEl.textContent = VIEW_META.assets.eyebrow;
  }
}

/* 初始渲染 */
renderDashboard();
renderPdmBlock();
renderSpareParts();
renderMaintenance();
renderFaults();
renderNotifications();
renderKb();
renderAdmin();
renderMeta();
setAbnormal(30);
setHealth(1);

/* ---------- 后台管理 ---------- */
document.getElementById("admin-tabs").addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  const tab = chip.dataset.tab;
  document.querySelectorAll("#admin-tabs .chip").forEach((item) => {
    item.classList.toggle("active", item === chip);
  });
  document.querySelectorAll(".admin-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${tab}`);
  });
});

const testBtn = document.getElementById("ai-test-btn");
const testResult = document.getElementById("ai-test-result");
testBtn.addEventListener("click", () => {
  testBtn.disabled = true;
  testBtn.textContent = "测试中";
  testResult.textContent = "正在请求模型…";
  window.setTimeout(() => {
    testBtn.disabled = false;
    testBtn.textContent = "测试连通性";
    testResult.innerHTML = '<span class="text-mint">连通正常 · deepseek-chat · 1.2s</span>';
  }, 1200);
});
