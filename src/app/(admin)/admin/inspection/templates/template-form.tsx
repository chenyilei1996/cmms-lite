"use client";

import { Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useActionState, useRef, useState } from "react";
import type { ChecklistItem } from "@/db/schema";
import {
  createTemplate,
  updateTemplate,
  type TemplateFormState,
} from "@/server/inspection-actions";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

type Row = {
  key: number;
  label: string;
  type: ChecklistItem["type"];
  required: boolean;
};

type TemplateInitial = {
  id: string;
  name: string;
  category: string;
  items: ChecklistItem[];
};

const typeLabels: Record<ChecklistItem["type"], string> = {
  check: "检查（正常/异常）",
  number: "数值",
  text: "文本",
};

export function TemplateForm({
  initial,
  submitLabel = "保存模板",
}: {
  initial?: TemplateInitial;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<TemplateFormState, FormData>(
    initial ? updateTemplate : createTemplate,
    {},
  );
  const nextKey = useRef(initial?.items.length ?? 1);
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.items.length
      ? initial.items.map((item, index) => ({
          key: index,
          label: item.label,
          type: item.type,
          required: Boolean(item.required),
        }))
      : [{ key: 0, label: "", type: "check", required: true }],
  );

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    const key = nextKey.current;
    nextKey.current += 1;
    setRows((prev) => [
      ...prev,
      { key, label: "", type: "check", required: true },
    ]);
  }

  function removeRow(key: number) {
    setRows((prev) =>
      prev.length === 1 ? prev : prev.filter((row) => row.key !== key),
    );
  }

  return (
    <form action={action} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="card p-5 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="模板名称" required>
            <Input
              name="name"
              placeholder="如 注塑机日常点检"
              required
              defaultValue={initial?.name}
            />
          </Field>
          <Field label="设备类别" required>
            <Input
              name="category"
              placeholder="如 注塑设备 / 通用"
              required
              defaultValue={initial?.category}
            />
          </Field>
        </div>
      </div>

      <div className="card p-5 lg:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold">检查项</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              检查项会按顺序出现在现场点检页，异常项可自动触发维修工单。
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] text-ink-soft transition-colors hover:border-ink/25"
          >
            <Plus className="size-3.5" /> 添加检查项
          </button>
        </div>

        <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 sm:grid-cols-[1fr_170px_auto_auto]"
            >
              <input
                name={`itemLabel_${index}`}
                value={row.label}
                onChange={(event) =>
                  updateRow(row.key, { label: event.target.value })
                }
                placeholder={`检查项 ${index + 1}，如 液压油位与油温`}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px] focus:border-ink/30 focus:outline-none"
              />
              <Select
                name={`itemType_${index}`}
                value={row.type}
                onChange={(event) =>
                  updateRow(row.key, {
                    type: event.target.value as ChecklistItem["type"],
                  })
                }
                className="!h-9 !rounded-lg !py-0 text-[12px]"
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <label className="flex cursor-pointer items-center gap-1.5 px-1 text-[11px] text-muted">
                <input
                  type="checkbox"
                  name={`itemRequired_${index}`}
                  checked={row.required}
                  onChange={(event) =>
                    updateRow(row.key, { required: event.target.checked })
                  }
                  className="size-3.5 accent-ink"
                />
                必填
              </label>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                aria-label="删除检查项"
                className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-30"
              >
                <Trash className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
          <WarningCircle className="size-4" /> {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
