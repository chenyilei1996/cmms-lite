import type { Tone } from "./constants";

export const PDM_METRIC: Record<
  string,
  { label: string; unit: string; tone: Tone }
> = {
  vibration: { label: "振动", unit: "mm/s", tone: "accent" },
  temperature: { label: "温度", unit: "℃", tone: "honey" },
  current: { label: "电流", unit: "A", tone: "mint" },
  oil: { label: "油液", unit: "—", tone: "neutral" },
  other: { label: "其他", unit: "—", tone: "neutral" },
};

export const PDM_RULE_MODE: Record<string, { label: string; hint: string }> = {
  threshold: {
    label: "阈值",
    hint: "最新读数越过阈值即触发",
  },
  duration: {
    label: "持续时长",
    hint: "近 N 分钟内读数全部越限且跨度达标才触发",
  },
  slope: {
    label: "趋势斜率",
    hint: "最近 24h 线性回归斜率按天折算后超过设定值",
  },
  combined: {
    label: "组合条件",
    hint: "阈值 + 持续时长 / 趋势斜率同时满足",
  },
};

export const PDM_DIRECTION: Record<string, { label: string }> = {
  above: { label: "高于阈值" },
  below: { label: "低于阈值" },
};

export const PDM_SEVERITY: Record<
  string,
  { label: string; tone: Tone; rank: number }
> = {
  info: { label: "提示", tone: "neutral", rank: 1 },
  warning: { label: "预警", tone: "honey", rank: 2 },
  critical: { label: "严重", tone: "danger", rank: 3 },
};

export const PDM_ALARM_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: "待处理", tone: "danger" },
  acknowledged: { label: "已确认", tone: "honey" },
  converted: { label: "已转建议", tone: "mint" },
  dismissed: { label: "已忽略", tone: "neutral" },
};

export const PDM_SUGGESTION_STATUS: Record<
  string,
  { label: string; tone: Tone }
> = {
  pending: { label: "待确认", tone: "honey" },
  converted: { label: "已转工单", tone: "mint" },
  dismissed: { label: "已驳回", tone: "neutral" },
};

export const PDM_SENSOR_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "监测中", tone: "mint" },
  inactive: { label: "已停用", tone: "neutral" },
};

export type PdmRuleShape = {
  mode: "threshold" | "duration" | "slope" | "combined";
  direction: "above" | "below";
  threshold: number | string | null;
  durationMinutes: number | null;
  slopePerDay: number | string | null;
  severity: "info" | "warning" | "critical";
};

export type PdmReadingShape = { value: number; recordedAt: Date };

export type RuleEvaluation = {
  hit: boolean;
  value: number | null;
  threshold: number | null;
  message: string;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function exceeds(value: number, threshold: number, direction: "above" | "below") {
  return direction === "above" ? value > threshold : value < threshold;
}

function withinWindow(
  readings: PdmReadingShape[],
  now: Date,
  minutes: number,
) {
  const start = now.getTime() - minutes * 60000;
  return readings.filter(
    (reading) => reading.recordedAt.getTime() >= start,
  );
}

function durationHit(
  readings: PdmReadingShape[],
  now: Date,
  threshold: number,
  direction: "above" | "below",
  minutes: number,
) {
  const window = withinWindow(readings, now, minutes);
  if (window.length < 2) return false;
  if (!window.every((reading) => exceeds(reading.value, threshold, direction))) {
    return false;
  }
  const first = window[0].recordedAt.getTime();
  const last = window[window.length - 1].recordedAt.getTime();
  return last - first >= minutes * 0.5 * 60000;
}

/** 最近 24 小时最小二乘斜率，按天折算。 */
export function trendSlopePerDay(readings: PdmReadingShape[], now: Date) {
  const window = withinWindow(readings, now, 24 * 60).sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );
  if (window.length < 3) return null;
  const first = window[0].recordedAt.getTime();
  const last = window[window.length - 1].recordedAt.getTime();
  if (last - first < 3 * 3600000) return null;

  const xs = window.map((reading) => (reading.recordedAt.getTime() - first) / 86400000);
  const ys = window.map((reading) => reading.value);
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < xs.length; i += 1) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * 规则评估：纯函数，不写库。
 * - threshold：最新读数越过阈值
 * - duration：窗口内全部越限且时间跨度 >= 设定时长的一半
 * - slope：最近 24h 斜率朝危险方向且绝对值达到设定值/天
 * - combined：阈值成立，并同时满足已配置的持续时长与斜率条件
 */
export function evaluateRule(
  rule: PdmRuleShape,
  readings: PdmReadingShape[],
  now: Date,
  unit = "",
): RuleEvaluation {
  const sorted = [...readings].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );
  const latest = sorted[sorted.length - 1] ?? null;
  const threshold = toNumber(rule.threshold);
  const durationMinutes = Math.max(0, Number(rule.durationMinutes ?? 0));
  const slopeLimit = toNumber(rule.slopePerDay);
  const suffix = unit ? ` ${unit}` : "";

  if (!latest) {
    return { hit: false, value: null, threshold, message: "暂无读数" };
  }

  if (rule.mode === "threshold") {
    if (threshold === null) {
      return {
        hit: false,
        value: latest.value,
        threshold: null,
        message: "规则未配置阈值",
      };
    }
    const hit = exceeds(latest.value, threshold, rule.direction);
    return {
      hit,
      value: latest.value,
      threshold,
      message: hit
        ? `最新读数 ${latest.value}${suffix} ${rule.direction === "above" ? "高于" : "低于"}阈值 ${threshold}${suffix}`
        : `最新读数 ${latest.value}${suffix} 未越过阈值 ${threshold}${suffix}`,
    };
  }

  if (rule.mode === "duration") {
    if (threshold === null) {
      return {
        hit: false,
        value: latest.value,
        threshold: null,
        message: "规则未配置阈值",
      };
    }
    const minutes = Math.max(1, durationMinutes || 60);
    const hit = durationHit(sorted, now, threshold, rule.direction, minutes);
    return {
      hit,
      value: latest.value,
      threshold,
      message: hit
        ? `近 ${minutes} 分钟读数持续 ${rule.direction === "above" ? "高于" : "低于"} ${threshold}${suffix}`
        : `近 ${minutes} 分钟未形成持续越限`,
    };
  }

  if (rule.mode === "slope") {
    const slope = trendSlopePerDay(sorted, now);
    if (slope === null) {
      return {
        hit: false,
        value: latest.value,
        threshold: slopeLimit,
        message: "24h 内读数不足，暂无法判断趋势",
      };
    }
    if (slopeLimit === null) {
      return {
        hit: false,
        value: latest.value,
        threshold: null,
        message: "规则未配置斜率阈值",
      };
    }
    const dangerous =
      rule.direction === "above" ? slope >= slopeLimit : slope <= -slopeLimit;
    return {
      hit: dangerous,
      value: latest.value,
      threshold: slopeLimit,
      message: `24h 趋势 ${slope >= 0 ? "+" : ""}${slope.toFixed(2)}${suffix}/天，${
        dangerous ? "已达到" : "未达到"
      }危险方向 ${slopeLimit}${suffix}/天`,
    };
  }

  // combined
  if (threshold === null) {
    return {
      hit: false,
      value: latest.value,
      threshold: null,
      message: "组合规则未配置阈值",
    };
  }
  const baseHit = exceeds(latest.value, threshold, rule.direction);
  const durationOk =
    durationMinutes > 0
      ? durationHit(sorted, now, threshold, rule.direction, durationMinutes)
      : true;
  const slope = trendSlopePerDay(sorted, now);
  const slopeOk =
    slopeLimit !== null && slopeLimit > 0
      ? slope !== null &&
        (rule.direction === "above"
          ? slope >= slopeLimit
          : slope <= -slopeLimit)
      : true;
  const hit = baseHit && durationOk && slopeOk;
  const conditions: string[] = [];
  if (durationMinutes > 0) conditions.push(`持续 ${durationMinutes} 分钟`);
  if (slopeLimit !== null && slopeLimit > 0) conditions.push(`斜率 ${slopeLimit}/天`);
  return {
    hit,
    value: latest.value,
    threshold,
    message: hit
      ? `组合条件成立：最新 ${latest.value}${suffix} 越限${conditions.length ? `，且 ${conditions.join("、")}` : ""}`
      : `组合条件未全部满足（阈值${baseHit ? "成立" : "不成立"}${conditions.length ? `，${conditions.join("、")}` : ""}）`,
  };
}
