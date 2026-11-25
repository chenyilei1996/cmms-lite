"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import {
  createPlan,
  updatePlan,
  type PlanFormState,
} from "@/server/inspection-actions";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { UnsavedChangesGuard } from "@/components/unsaved-guard";

type PlanInitial = {
  id: string;
  name: string;
  assetId: string;
  templateId: string;
  type: string;
  triggerType?: string;
  counterType?: string | null;
  counterInterval?: number | null;
  cycleDays: number;
  nextDueAt: string;
  assigneeId: string | null;
  standardMinutes?: number | null;
  safetyNotes?: string | null;
  requiredTools?: string | null;
};

export function PlanForm({
  assets,
  templates,
  assignees,
  today,
  initial,
  submitLabel = "保存计划",
}: {
  assets: { id: string; code: string; name: string }[];
  templates: { id: string; name: string; category: string }[];
  assignees: { id: string; name: string }[];
  today: string;
  initial?: PlanInitial;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<PlanFormState, FormData>(
    initial ? updatePlan : createPlan,
    {},
  );

  return (
    <form id="inspection-plan-form" action={action} className="space-y-4">
      <UnsavedChangesGuard formId="inspection-plan-form" />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="card p-5 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="计划名称" required className="sm:col-span-2">
            <Input
              name="name"
              placeholder="如 一号注塑机日点检"
              required
              defaultValue={initial?.name}
            />
          </Field>
          <Field label="设备" required>
            <Select
              name="assetId"
              required
              defaultValue={initial?.assetId ?? ""}
            >
              <option value="" disabled>
                选择设备
              </option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.code} · {asset.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="检查模板" required>
            <Select
              name="templateId"
              required
              defaultValue={initial?.templateId ?? ""}
            >
              <option value="" disabled>
                选择模板
              </option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.category}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="类型">
            <Select name="type" defaultValue={initial?.type ?? "inspection"}>
              <option value="inspection">巡检</option>
              <option value="maintenance">保养 / PM</option>
            </Select>
          </Field>
          <Field label="触发方式" hint="保养类可按运行计数触发">
            <Select name="triggerType" defaultValue={initial?.triggerType ?? "time"}>
              <option value="time">按时间周期</option>
              <option value="counter">按运行计数</option>
            </Select>
          </Field>
          <Field label="计数类型">
            <Select name="counterType" defaultValue={initial?.counterType ?? ""}>
              <option value="">不适用</option>
              <option value="runtime_hours">运行小时</option>
              <option value="output">产量</option>
              <option value="actions">动作次数</option>
            </Select>
          </Field>
          <Field label="计数间隔" hint="达到间隔自动建 PM 工单">
            <Input
              name="counterInterval"
              type="number"
              min={0}
              defaultValue={initial?.counterInterval ?? ""}
              placeholder="如 500"
            />
          </Field>
          <Field label="周期（天）" hint="按自然日计算">
            <Input
              name="cycleDays"
              type="number"
              min={1}
              defaultValue={initial?.cycleDays ?? 30}
              required
            />
          </Field>
          <Field label="首次到期">
            <Input
              name="nextDueAt"
              type="date"
              defaultValue={initial?.nextDueAt ?? today}
            />
          </Field>
          <Field label="标准工时（分钟）">
            <Input
              name="standardMinutes"
              type="number"
              min={0}
              defaultValue={initial?.standardMinutes ?? ""}
            />
          </Field>
          <Field label="所需工具">
            <Input
              name="requiredTools"
              defaultValue={initial?.requiredTools ?? ""}
              placeholder="如 扭矩扳手、万用表"
            />
          </Field>
          <Field label="负责人">
            <Select name="assigneeId" defaultValue={initial?.assigneeId ?? ""}>
              <option value="">暂不指派</option>
              {assignees.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="安全要求" className="sm:col-span-2">
            <textarea
              name="safetyNotes"
              defaultValue={initial?.safetyNotes ?? ""}
              placeholder="如 断电挂牌、佩戴护目镜"
              className="min-h-20 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px]"
            />
          </Field>
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
