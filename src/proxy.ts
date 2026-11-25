import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { requireSecret } from "@/lib/env";

const SESSION_COOKIE = "cmms_session";

/** 公开页面：扫码报修 / 点检 / 文档分享等带 token 的入口。 */
const PUBLIC_PREFIXES = ["/r/", "/t/", "/d/", "/i/", "/icons/", "/api/public/"];

/** 精确公开的路径，避免用前缀放过 /api/integrations 下的其他接口。 */
const PUBLIC_PATHS = new Set([
  "/login",
  "/icon.svg",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/robots.txt",
  "/api/health",
  "/api/pdm/readings",
  "/api/integrations/assets",
  "/api/integrations/cron",
]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(
      requireSecret("SESSION_SECRET", "dev-only-change-me-9f3a1c7e5b2d4a6f"),
    );
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    if (pathname === "/login") {
      // 账号被删除 / 停用后旧 JWT 仍可验签，这里清掉失效会话，避免登录页与工作台互相重定向
      if (request.nextUrl.searchParams.get("expired") === "1") {
        const response = NextResponse.next();
        response.cookies.delete(SESSION_COOKIE);
        return response;
      }
      if (await hasValidSession(request)) {
        return NextResponse.redirect(new URL("/app/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  if (!(await hasValidSession(request))) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
