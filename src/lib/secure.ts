import { timingSafeEqual } from "node:crypto";

/** 定长比较，避免通过响应时间推断令牌。 */
export function safeEqual(input: string, expected: string) {
  if (!input || !expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
