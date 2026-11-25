"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import {
  createWorkOrder,
  type WorkOrderFormState,
} from "@/server/work-order-actions";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { UnsavedChangesGuard } from "@/components/unsaved-guard";

export function WorkOrderForm({
  assets,
  assignees,
}: {
  assets: { id: string; code: string; name: string }[];
  assignees: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<WorkOrderFormState, FormData>(
    createWorkOrder,
    {},
  );

  return (
    <form id="work-order-create-form" action={action} className="space-y-4">
      <UnsavedChangesGuard formId="work-order-create-form" />
      <div className="card p-5 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="设备" required className="sm:col-span-2">
            <Select name="assetId" required defaultValue="">
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
          <Field label="工单标题" required className="sm:col-span-2">
            <Input name="title" placeholder="一句话说明问题" required />
          </Field>
          <Field label="工单类型">
            <Select name="type" defaultValue="fault">
              <option value="fault">故障报修</option>
              <option value="corrective">纠正性维修</option>
              <option value="pm">预防性维护</option>
              <option value="inspection">点检异常</option>
              <option value="project">改造 / 项目</option>
            </Select>
          </Field>
          <Field label="优先级">
            <Select name="priority" defaultValue="medium">
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </Select>
          </Field>
          <Field label="故障代码" hint="按企业编码填写，后续可统计">
            <Input name="faultCode" placeholder="如 MECH-042" />
          </Field>
          <Field label="故障现象">
            <Input name="faultPhenomenon" placeholder="如 合模异响、液压油温高" />
          </Field>
          <Field label="指派给">
            <Select name="assigneeId" defaultValue="">
              <option value="">暂不指派</option>
              {assignees.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="期望完成日期">
            <Input name="dueAt" type="date" />
          </Field>
          <Field label="详细描述" className="sm:col-span-2">
            <Textarea
              name="description"
              placeholder="故障现象、已做处理、需要备件等"
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
        <SubmitButton size="lg">创建工单</SubmitButton>
      </div>
    </form>
  );
}
