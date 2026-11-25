import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // 统一安全响应头：防嗅探、防嵌套、限制引用来源；CSP 先用 Report-Only 观察。
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  // 前后台分域后保留旧链接可用：旧地址统一 307 到 /app 或 /admin 下的新路径。
  async redirects() {
    return [
      { source: "/dashboard", destination: "/app/dashboard", permanent: false },
      { source: "/notifications", destination: "/app/notifications", permanent: false },
      { source: "/work-orders/:path*", destination: "/app/work-orders/:path*", permanent: false },
      { source: "/work-orders", destination: "/app/work-orders", permanent: false },
      { source: "/kb/:path*", destination: "/app/kb/:path*", permanent: false },
      { source: "/kb", destination: "/app/kb", permanent: false },
      { source: "/assets/new", destination: "/admin/assets/new", permanent: false },
      { source: "/assets/qr", destination: "/admin/assets/qr", permanent: false },
      { source: "/assets/tree", destination: "/admin/assets/tree", permanent: false },
      { source: "/assets/:path*", destination: "/app/assets/:path*", permanent: false },
      { source: "/assets", destination: "/app/assets", permanent: false },
      { source: "/inspection/templates", destination: "/admin/inspection/templates", permanent: false },
      { source: "/inspection/plans", destination: "/admin/inspection/plans", permanent: false },
      { source: "/inspection/:path*", destination: "/app/inspection/:path*", permanent: false },
      { source: "/inspection", destination: "/app/inspection", permanent: false },
      { source: "/spare-parts/new", destination: "/admin/spare-parts/new", permanent: false },
      { source: "/spare-parts/qr", destination: "/admin/spare-parts/qr", permanent: false },
      { source: "/spare-parts/stocktake", destination: "/admin/spare-parts/stocktake", permanent: false },
      { source: "/spare-parts/:path*", destination: "/app/spare-parts/:path*", permanent: false },
      { source: "/spare-parts", destination: "/app/spare-parts", permanent: false },
      { source: "/faults/codes", destination: "/admin/faults/codes", permanent: false },
      { source: "/faults", destination: "/app/faults", permanent: false },
      { source: "/pdm/sensors", destination: "/admin/pdm/sensors", permanent: false },
      { source: "/pdm/:path*", destination: "/app/pdm/:path*", permanent: false },
      { source: "/pdm", destination: "/app/pdm", permanent: false },
      { source: "/analytics/:path*", destination: "/admin/analytics/:path*", permanent: false },
      { source: "/analytics", destination: "/admin/analytics", permanent: false },
      { source: "/integrations/:path*", destination: "/admin/integrations/:path*", permanent: false },
      { source: "/integrations", destination: "/admin/integrations", permanent: false },
      { source: "/settings/profile", destination: "/app/profile", permanent: false },
      { source: "/settings/:path*", destination: "/admin/settings/:path*", permanent: false },
      { source: "/settings", destination: "/admin/settings", permanent: false },
    ];
  },
};

export default nextConfig;
