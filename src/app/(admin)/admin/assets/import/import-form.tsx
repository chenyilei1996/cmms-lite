"use client";

import {
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { useState } from "react";

import { LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { importAssetsCsv } from "@/server/asset-import-actions";

type Preview = {
  ok?: boolean;
  error?: string;
  encoding?: string;
  totalRows?: number;
  columns?: string[];
  missingRequired?: number;
  duplicates?: number;
  preview?: Array<Record<string, string>>;
};

export function ImportForm() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState<"upsert" | "insert_only">("upsert");
  const [fileName, setFileName] = useState("");

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setConfirmed(false);
    setFileName(file?.name ?? "");
    if (!file) return;

    setLoading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/import/assets/preview", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as Preview;
      if (!response.ok) {
        setPreview({ error: data.error ?? "预览失败" });
      } else {
        setPreview(data);
      }
    } catch {
      setPreview({ error: "预览失败，请检查网络后重试" });
    } finally {
      setLoading(false);
    }
  }

  const ready = Boolean(preview?.ok && confirmed && !loading);

  return (
    <form
      action={importAssetsCsv}
      encType="multipart/form-data"
      className="mt-4 flex flex-col gap-3"
    >
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        onChange={handleFile}
        className="block w-full cursor-pointer rounded-lg border border-line bg-surface px-3 py-2.5 text-[12px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-[11px] file:text-white"
      />

      {loading && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <CircleNotch className="size-3.5 animate-spin" /> 正在解析 {fileName}…
        </p>
      )}

      {preview?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-[11px] text-danger">
          <WarningCircle className="size-3.5" /> {preview.error}
        </p>
      )}

      {preview?.ok && (
        <div className="rounded-xl border border-line bg-paper/60 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
            <CheckCircle className="size-3.5 text-mint" />
            共 {preview.totalRows ?? 0} 行 · {preview.columns?.length ?? 0} 列
            {preview.encoding === "gb18030" ? " · 已自动识别 GBK 编码" : ""}
          </p>

          {(preview.missingRequired ?? 0) > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-honey">
              <WarningCircle className="size-3.5" />
              {preview.missingRequired} 行缺少编码 / 名称 / 类别，将被跳过
            </p>
          )}
          {(preview.duplicates ?? 0) > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-honey">
              <WarningCircle className="size-3.5" />
              文件内有 {preview.duplicates} 个重复编码，仅保留首次出现
            </p>
          )}

          {preview.preview && preview.preview.length > 0 && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[420px] text-left text-[10px]">
                <thead className="bg-paper/70 text-muted">
                  <tr>
                    {(preview.columns ?? []).slice(0, 8).map((column) => (
                      <th key={column} className="whitespace-nowrap px-2 py-1.5 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.preview.map((row, index) => (
                    <tr key={index}>
                      {Object.entries(row).map(([key, value]) => (
                        <td key={key} className="max-w-[160px] truncate px-2 py-1.5">
                          {value || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <label className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="size-3.5 accent-[#2e5a7d]"
            />
            我已核对预览内容，确认写入设备台账
          </label>
        </div>
      )}

      <input type="hidden" name="mode" value={mode} />
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { value: "upsert", label: "覆盖更新" },
            { value: "insert_only", label: "仅新增" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={
              mode === option.value
                ? "rounded-full bg-ink px-3 py-1.5 text-[11px] text-white"
                : "rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-muted"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton size="sm" disabled={!ready}>
          <UploadSimple className="size-4" /> 开始导入
        </SubmitButton>
        <LinkButton
          href="/api/import/assets/template"
          variant="secondary"
          size="sm"
        >
          <DownloadSimple className="size-4" /> 下载模板
        </LinkButton>
      </div>
    </form>
  );
}
