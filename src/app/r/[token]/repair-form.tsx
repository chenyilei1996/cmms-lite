"use client";

import { Camera, Warning, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";

import { submitRepair, type RepairFormState } from "@/server/public-actions";
import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import type { RepairDuplicate } from "@/lib/repair";
import { fmtDate } from "@/lib/utils";

const priorities = [
  { value: "medium", label: "一般", hint: "不影响生产" },
  { value: "high", label: "较高", hint: "影响效率" },
  { value: "urgent", label: "紧急", hint: "已经停机" },
];

const MAX_PHOTOS = 3;
const MAX_PHOTO_SIZE = 8 * 1024 * 1024;

type Preview = { file: File; url: string };

/** 大图在手机端先压缩，减少现场弱网下的上传失败。 */
async function compressImage(file: File): Promise<File> {
  if (file.type === "image/heic" || file.type === "image/heif") return file;
  if (file.size <= 1.2 * 1024 * 1024) return file;
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    bitmap.close();
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
      lastModified: new Date().getTime(),
    });
  } catch {
    return file;
  }
}

export function RepairForm({
  assetToken,
  duplicate,
}: {
  assetToken: string;
  duplicate: RepairDuplicate | null;
}) {
  const [state, action] = useActionState<RepairFormState, FormData>(
    submitRepair,
    {},
  );
  // React 表单 action 完成后会重置表单；出错时用 key 重挂载并回显已填内容
  const values = state.values;
  const formKey = state.attempt ?? 0;
  const currentDuplicate = duplicate ?? state.duplicate ?? null;

  const [acknowledged, setAcknowledged] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function applyFiles(files: File[]) {
    const data = new DataTransfer();
    files.forEach((file) => data.items.add(file));
    if (inputRef.current) inputRef.current.files = data.files;
    setPreviews(
      files.map((file) => {
        const url = URL.createObjectURL(file);
        urlsRef.current.push(url);
        return { file, url };
      }),
    );
  }

  async function handlePhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    if (selected.length === 0) return;
    setPhotoError(null);

    if (selected.length > MAX_PHOTOS) {
      setPhotoError(`最多上传 ${MAX_PHOTOS} 张，已保留前 ${MAX_PHOTOS} 张`);
    }

    const processed: File[] = [];
    for (const file of selected.slice(0, MAX_PHOTOS)) {
      if (!file.type.startsWith("image/")) {
        setPhotoError("仅支持图片文件");
        continue;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        setPhotoError(`${file.name} 超过 8MB，请重新拍摄`);
        continue;
      }
      processed.push(await compressImage(file));
    }
    applyFiles(processed);
  }

  function removePhoto(index: number) {
    const remaining = previews.filter((_, itemIndex) => itemIndex !== index);
    applyFiles(remaining.map((item) => item.file));
  }

  // 服务端校验失败时表单会重挂载，重新把已选照片写回文件输入，避免用户重拍
  useEffect(() => {
    if (!inputRef.current || previews.length === 0) return;
    const data = new DataTransfer();
    previews.forEach((item) => data.items.add(item.file));
    inputRef.current.files = data.files;
  }, [formKey, previews]);

  return (
    <form key={formKey} action={action} className="space-y-4">
      <input type="hidden" name="assetToken" value={assetToken} />
      <input type="hidden" name="confirmDuplicate" value={acknowledged ? "1" : "0"} />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {currentDuplicate && (
        <div className="rounded-xl border border-honey/30 bg-honey-soft/60 px-4 py-3">
          <div className="flex items-start gap-2">
            <Warning className="mt-0.5 size-4 shrink-0 text-honey" />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-honey">
                该设备已有处理中记录
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                {currentDuplicate.kind === "work_order"
                  ? `工单 ${currentDuplicate.code} · ${currentDuplicate.statusLabel}`
                  : `待受理报修 · ${currentDuplicate.statusLabel}`}
                {" · "}
                {fmtDate(currentDuplicate.createdAt)}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {currentDuplicate.title}
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                请先确认现场是否仍未恢复。若已有维修人员处理，建议等待现有工单，
                避免重复派工。
              </p>
              <label className="mt-2.5 flex items-start gap-2 text-[11px] text-ink-soft">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-0.5 size-3.5"
                />
                我确认这是新的故障，仍要提交
              </label>
            </div>
          </div>
        </div>
      )}

      <Field label="故障现象" required hint="尽量描述位置和声音">
        <Textarea
          name="description"
          required
          minLength={5}
          placeholder="例如：合模时听到异响，产品边缘出现飞边，目前已停机。"
          className="min-h-32"
          defaultValue={values?.description}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="联系人" required>
          <Input
            name="reporterName"
            placeholder="你的姓名"
            required
            defaultValue={values?.reporterName}
          />
        </Field>
        <Field label="手机号">
          <Input
            name="reporterPhone"
            type="tel"
            inputMode="tel"
            placeholder="便于维修联系"
            defaultValue={values?.reporterPhone}
          />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-soft">紧急程度</p>
        <div className="grid grid-cols-3 gap-2">
          {priorities.map((item) => (
            <label key={item.value} className="cursor-pointer">
              <input
                type="radio"
                name="priority"
                value={item.value}
                defaultChecked={(values?.priority ?? "medium") === item.value}
                className="peer sr-only"
              />
              <span className="flex flex-col items-center rounded-xl border border-line bg-surface px-2 py-2.5 text-center transition-all peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-ink">
                <span className="text-[12px] font-medium">{item.label}</span>
                <span className="mt-0.5 text-[10px] opacity-60">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-soft">
          现场照片
          <span className="ml-1 font-normal text-muted">
            选填 · 最多 {MAX_PHOTOS} 张
          </span>
        </p>

        {previews.length > 0 && (
          <div className="mb-2 grid grid-cols-3 gap-2">
            {previews.map((item, index) => (
              <div
                key={item.url}
                className="relative overflow-hidden rounded-xl border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={`现场照片 ${index + 1}`}
                  className="h-24 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label={`移除第 ${index + 1} 张照片`}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink/70 text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper/50 px-4 py-6 text-center transition-colors hover:border-ink/30">
          <Camera className="mb-2 size-5 text-muted" />
          <span className="text-[12px] text-ink-soft">
            {previews.length > 0 ? "重新选择照片" : "拍照或从相册选择"}
          </span>
          <span className="mt-0.5 text-[10px] text-muted">
            支持 JPG / PNG / HEIC，大图会自动压缩
          </span>
          <input
            ref={inputRef}
            type="file"
            name="photos"
            accept="image/*"
            multiple
            onChange={handlePhotos}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        {photoError && (
          <p className="mt-1.5 text-[10px] text-danger">{photoError}</p>
        )}
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
          <WarningCircle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton
        className="w-full"
        size="lg"
        pendingText="正在提交…"
        disabled={Boolean(currentDuplicate && !acknowledged)}
      >
        {currentDuplicate && !acknowledged
          ? "请先确认重复报修"
          : "提交报修"}
      </SubmitButton>
      <p className="text-center text-[10px] leading-relaxed text-muted">
        提交后会生成专属进度链接，请截图或收藏，不要转发给无关人员。
      </p>
    </form>
  );
}
