"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          background: "#f5f4f0",
          color: "#161513",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.18em", color: "#8d8a82" }}>
            SYSTEM ERROR
          </p>
          <h1 style={{ margin: "12px 0 8px", fontSize: 24, fontWeight: 600 }}>
            页面暂时无法加载
          </h1>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#6e6c65" }}>
            系统遇到了未预期的异常，已记录错误信息。可以重试，或稍后再访问。
          </p>
          {error.digest ? (
            <p style={{ marginTop: 12, fontSize: 11, color: "#8d8a82", fontFamily: "monospace" }}>
              错误编号：{error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: "#161513",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}
