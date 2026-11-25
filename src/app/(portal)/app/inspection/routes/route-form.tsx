"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { createRoute, type RouteFormState } from "@/server/route-actions";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

export function RouteForm({
  assignees,
}: {
  assignees: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<RouteFormState, FormData>(
    createRoute,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <Field label="路线名称" required>
        <Input name="name" placeholder="如 一号车间早班点检线" required />
      </Field>
      <Field label="周期（天）" hint="到期自动生成待执行任务">
        <Input name="cycleDays" type="number" min={1} defaultValue={7} required />
      </Field>
      <Field label="默认负责人">
        <Select name="assigneeId" defaultValue="">
          <option value="">暂不指派</option>
          {assignees.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      </Field>

      {state?.error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
          <WarningCircle className="size-4" /> {state.error}
        </p>
      )}

      <SubmitButton className="w-full">创建路线并生成二维码</SubmitButton>
    </form>
  );
}
