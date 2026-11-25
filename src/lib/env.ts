const isProduction = process.env.NODE_ENV === "production";

/** 历史上出现过的弱默认值，生产环境必须替换。 */
const WEAK_VALUES = new Set([
  "please-change-this-in-production",
  "dev-only-change-me-9f3a1c7e5b2d4a6f",
  "dev-pdm-token",
  "change-me",
]);

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * 读取必须的密钥。
 * 开发环境允许回退到本地默认值；生产环境缺失或仍为弱默认值时抛错，
 * 由调用方转成 503 / 拒绝访问，避免带着可预测密钥上线。
 */
export function requireSecret(name: string, devFallback: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    if (isProduction) throw new ConfigError(`缺少必需的环境变量 ${name}`);
    return devFallback;
  }
  if (isProduction && WEAK_VALUES.has(value)) {
    throw new ConfigError(`环境变量 ${name} 仍为弱默认值，请更换`);
  }
  return value;
}

/** 可选令牌：未配置或仍是弱默认值时视为关闭该入口。 */
export function optionalSecret(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) return "";
  if (isProduction && WEAK_VALUES.has(value)) return "";
  return value;
}

/** 把异常转成可对外展示的最简提示，不暴露内部细节。 */
export function publicError(error: unknown, fallback = "服务暂时不可用") {
  if (error instanceof ConfigError) return "服务未完成安全配置，请联系管理员";
  return fallback;
}
