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
};

const titleEl = document.getElementById("page-title");
const eyebrowEl = document.getElementById("page-eyebrow");

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

/* ---------- 点检异常时间窗 ---------- */
const ABNORMAL_DATA = {
  7: { items: 11, points: 6, repeat: 2, converted: 3, assets: 4 },
  30: { items: 26, points: 11, repeat: 4, converted: 7, assets: 7 },
  90: { items: 68, points: 19, repeat: 6, converted: 16, assets: 9 },
};

function setAbnormal(days) {
  const data = ABNORMAL_DATA[days];
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

function renderSensors(days) {
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
    answer.innerHTML = `<p class="q">问：${question}</p>
      <p class="a">正在检索知识库并请求模型，通常需要 5–20 秒…</p>`;
    window.setTimeout(() => {
      answer.innerHTML = `<p class="q">问：${question}</p>
        ${canned.answer.map((paragraph) => `<p class="a">${paragraph}</p>`).join("")}
        <div class="sources">${canned.sources.map((source) => `<span class="src">${source}</span>`).join("")}</div>
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

/* 初始渲染 */
setAbnormal(30);
setHealth(1);

/* ---------- 设备台账 ---------- */
const ASSETS = [
  { id: "EQ-001", name: "注塑机 A 线", workshop: "注塑车间", area: "注塑一线", status: "运行中", tone: "mint", grade: "A 类", owner: "李强", since: "2021-06", lastCheck: "11-25 09:05", wo: 1, pdm: "液压油温 45 ℃", note: "合模异响工单处理中" },
  { id: "EQ-011", name: "空压机 1#", workshop: "公用工程", area: "空压站", status: "故障", tone: "danger", grade: "A 类", owner: "王敏", since: "2019-03", lastCheck: "11-25 08:22", wo: 2, pdm: "排气温度 98.6 ℃", note: "PDM 严重报警，已生成建议工单" },
  { id: "EQ-021", name: "冲床 2#", workshop: "冲压车间", area: "冲压二线", status: "运行中", tone: "mint", grade: "A 类", owner: "赵磊", since: "2020-09", lastCheck: "11-24 15:41", wo: 0, pdm: "滑块温度 41 ℃", note: "润滑保养已完成" },
  { id: "EQ-031", name: "冷却塔", workshop: "公用工程", area: "循环水站", status: "保养中", tone: "honey", grade: "B 类", owner: "张伟", since: "2018-11", lastCheck: "11-24 10:18", wo: 1, pdm: "风机振动 4.8 mm/s", note: "月度保养完成，观察振动趋势" },
  { id: "EQ-041", name: "包装线", workshop: "包装车间", area: "包装一线", status: "运行中", tone: "mint", grade: "B 类", owner: "陈晨", since: "2022-04", lastCheck: "11-23 17:02", wo: 0, pdm: "总电流 210 A", note: "光电传感器已更换" },
  { id: "EQ-051", name: "行车 3#", workshop: "冲压车间", area: "模具区", status: "停用", tone: "neutral", grade: "C 类", owner: "赵磊", since: "2017-08", lastCheck: "11-20 08:00", wo: 0, pdm: "未接入测点", note: "钢丝绳检查逾期，暂停使用" },
];

function qrHtml(seed) {
  let cells = "";
  for (let i = 0; i < 49; i += 1) {
    const on = (i * 7 + seed * 13 + (i % 3)) % 5 < 2;
    cells += `<i class="${on ? "" : "blank"}"></i>`;
  }
  return `<div class="qr" aria-hidden="true">${cells}</div>`;
}

function renderAssets(selectedId) {
  const current = ASSETS.find((asset) => asset.id === selectedId) ?? ASSETS[0];
  document.getElementById("asset-list").innerHTML = ASSETS.map(
    (asset) => `<li class="${asset.id === current.id ? "selected" : ""}" data-asset="${asset.id}">
      <span class="mono">${asset.id}</span>
      <p><b>${asset.name}</b><em>${asset.workshop} · ${asset.area} · ${asset.grade}</em></p>
      <span class="badge ${asset.tone}">${asset.status}</span>
    </li>`,
  ).join("");

  document.getElementById("asset-detail").innerHTML = `
    <div class="asset-detail-head">
      ${qrHtml(ASSETS.indexOf(current) + 1)}
      <div>
        <p class="label-mono">${current.id} · ${current.grade}</p>
        <h2>${current.name}</h2>
        <p class="hint">${current.workshop} · ${current.area} · 责任人 ${current.owner}</p>
        <div style="margin-top:8px"><span class="badge ${current.tone}">${current.status}</span></div>
      </div>
    </div>
    <div class="asset-kv">
      <div><p class="k">设备编号</p><p class="v mono">${current.id}</p></div>
      <div><p class="k">投产时间</p><p class="v">${current.since}</p></div>
      <div><p class="k">安装位置</p><p class="v">${current.workshop} · ${current.area}</p></div>
      <div><p class="k">未关闭工单</p><p class="v">${current.wo} 张</p></div>
      <div><p class="k">最近点检</p><p class="v">${current.lastCheck}</p></div>
      <div><p class="k">PDM 最新读数</p><p class="v">${current.pdm}</p></div>
    </div>
    <ul class="timeline">
      <li><span>点检：日检完成</span><em>${current.lastCheck}</em></li>
      <li><span>工单：${current.note}</span><em>11-24</em></li>
      <li><span>保养：月度保养计划已排期</span><em>11-27</em></li>
      <li><span>台账：责任人 ${current.owner} 完成年度盘点</span><em>11-12</em></li>
    </ul>`;

  document.querySelectorAll("#asset-list li").forEach((item) => {
    item.addEventListener("click", () => renderAssets(item.dataset.asset));
  });
}

renderAssets("EQ-001");
