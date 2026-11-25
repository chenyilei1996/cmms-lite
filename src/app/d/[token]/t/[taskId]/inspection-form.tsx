"use client";

import { Camera, Warning, WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import type { ChecklistItem } from "@/db/schema";
import {
  submitInspectionByToken,
  type InspectionFormState,
} from "@/server/public-actions";
import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

export function InspectionForm({
  assetToken,
  taskId,
  items,
}: {
  assetToken: string;
  taskId: string;
  items: ChecklistItem[];
}) {
  const [state, action] = useActionState<InspectionFormState, FormData>(
    submitInspectionByToken,
    {},
  );
  const values = state.values;
  const formKey = state.attempt ?? 0;

  return (
    <form key={formKey} action={action} className="space-y-4">
      <input type="hidden" name="assetToken" value={assetToken} />
      <input type="hidden" name="taskId" value={taskId} />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <ol className="space-y-3">
        {items.map((item, index) => {
          const saved = values?.items[index];
          return (
            <li
              key={item.label}
              className="rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={
                    item.type === "check" ? undefined : `item_${index}`
                  }
                  className="text-[12px] font-medium"
                >
                  <span className="mr-2 font-mono text-[10px] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                  {item.required && <span className="ml-0.5 text-accent">*</span>}
                </label>
                <span className="text-[9px] text-muted">
                  {item.type === "check"
                    ? "检查"
                    : item.type === "number"
                      ? "数值"
                      : "文本"}
                </span>
              </div>

              {item.type === "check" ? (
                <div className="mt-2.5 flex gap-2">
                  {["正常", "异常"].map((value) => (
                    <label key={value} className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        id={value === "正常" ? `item_${index}` : undefined}
                        name={`item_${index}`}
                        value={value}
                        defaultChecked={(saved ?? "正常") === value}
                        required
                        className="peer sr-only"
                      />
                      <span className="flex items-center justify-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[11px] text-muted transition-all peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">
                        {value === "异常" && <Warning className="size-3" />}
                        {value}
                      </span>
                    </label>
                  ))}
                </div>
              ) : item.type === "number" ? (
                <input
                  id={`item_${index}`}
                  name={`item_${index}`}
                  type="number"
                  step="any"
                  placeholder="填写实测值"
                  required={item.required}
                  defaultValue={saved ?? ""}
                  className="mt-2.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none"
                />
              ) : (
                <input
                  id={`item_${index}`}
                  name={`item_${index}`}
                  placeholder="填写观察结果"
                  required={item.required}
                  defaultValue={saved ?? ""}
                  className="mt-2.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none"
                />
              )}
            </li>
          );
        })}
      </ol>

      <Field label="执行人" required>
        <Input
          name="executorName"
          placeholder="填写现场执行人姓名"
          required
          defaultValue={values?.executorName}
        />
      </Field>

      <Field label="点检备注" hint="选填">
        <Textarea
          name="note"
          placeholder="异常现象、处理建议或其他说明"
          className="min-h-24"
          defaultValue={values?.note}
        />
      </Field>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-soft">
          现场照片
          <span className="ml-1 font-normal text-muted">选填 · 最多 3 张</span>
        </p>
        <label className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper/50 px-4 py-6 text-center transition-colors hover:border-ink/30">
          <Camera className="mb-2 size-5 text-muted" />
          <span className="text-[12px] text-ink-soft">拍照或从相册选择</span>
          <span className="mt-0.5 text-[10px] text-muted">
            支持 JPG / PNG / HEIC，每张不超过 8MB
          </span>
          <input
            type="file"
            name="photos"
            accept="image/*"
            multiple
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
          <WarningCircle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton className="w-full" size="lg" pendingText="正在提交…">
        提交点检结果
      </SubmitButton>
      <p className="text-center text-[10px] leading-relaxed text-muted">
        提交后任务即完成；若检查项标记为异常，系统会自动生成维修工单。
      </p>
    </form>
  );
}
