"use client";

import { Camera, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import {
  submitRouteRun,
  type RouteRunState,
} from "@/server/route-actions";
import { SubmitButton } from "@/components/ui-client";

type Point = {
  id: string;
  name: string;
  checkType: string;
  standardMin: string | null;
  standardMax: string | null;
  unit: string | null;
  photoRequired: boolean;
  note: string | null;
};

type Group = {
  assetName: string;
  assetCode: string;
  points: Point[];
};

export function RouteRunForm({
  token,
  groups,
  photoRequired,
}: {
  token: string;
  groups: Group[];
  photoRequired: boolean;
}) {
  const [state, action] = useActionState<RouteRunState, FormData>(
    submitRouteRun,
    {},
  );

  return (
    <form key={state?.attempt ?? 0} action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
        <label className="block text-[12px] font-medium text-ink-soft">
          点检人姓名 <span className="text-accent">*</span>
        </label>
        <input
          name="executorName"
          required
          placeholder="请输入你的姓名"
          className="mt-2 h-12 w-full rounded-xl border border-line bg-paper/50 px-3.5 text-[15px] focus:border-ink/40 focus:outline-none"
        />
      </div>

      {groups.map((group) => (
        <section key={group.assetCode} className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[13px] font-semibold">{group.assetName}</h2>
            <span className="font-mono text-[10px] text-muted">{group.assetCode}</span>
          </div>
          {group.points.map((point) => (
            <div
              key={point.id}
              className="rounded-2xl bg-surface p-4 ring-1 ring-line"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">
                    {point.name}
                    {point.photoRequired && (
                      <Camera className="ml-1 inline size-3.5 text-honey" />
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {point.checkType === "number"
                      ? `标准 ${point.standardMin ?? "—"} ~ ${point.standardMax ?? "—"} ${point.unit ?? ""}`
                      : "正常 / 异常"}
                    {point.note ? ` · ${point.note}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line bg-paper/40 py-2.5 text-[13px] text-ink-soft has-[:checked]:border-mint has-[:checked]:bg-mint-soft has-[:checked]:text-mint">
                  <input
                    type="radio"
                    name={`item_${point.id}_status`}
                    value="ok"
                    defaultChecked
                    className="size-3.5 accent-mint"
                  />
                  正常
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line bg-paper/40 py-2.5 text-[13px] text-ink-soft has-[:checked]:border-danger has-[:checked]:bg-danger-soft has-[:checked]:text-danger">
                  <input
                    type="radio"
                    name={`item_${point.id}_status`}
                    value="abnormal"
                    className="size-3.5 accent-danger"
                  />
                  异常
                </label>
              </div>

              <input
                name={`item_${point.id}_value`}
                type={point.checkType === "number" ? "number" : "text"}
                step={point.checkType === "number" ? "0.01" : undefined}
                inputMode={point.checkType === "number" ? "decimal" : "text"}
                required={point.checkType === "number"}
                placeholder={
                  point.checkType === "number"
                    ? `实测值${point.unit ? `（${point.unit}）` : ""}`
                    : "实测 / 描述（选填）"
                }
                className="mt-2 h-12 w-full rounded-xl border border-line bg-paper/50 px-3.5 text-[15px] focus:border-ink/40 focus:outline-none"
              />
              <input
                name={`item_${point.id}_note`}
                placeholder="异常说明（异常时建议填写）"
                className="mt-2 h-11 w-full rounded-xl border border-line bg-paper/50 px-3.5 text-[13px] focus:border-ink/40 focus:outline-none"
              />
            </div>
          ))}
        </section>
      ))}

      <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
        <label className="block text-[12px] font-medium text-ink-soft">
          现场照片 {photoRequired && <span className="text-accent">*</span>}
        </label>
        <input
          type="file"
          name="photos"
          accept="image/*"
          capture="environment"
          multiple
          className="mt-2 w-full text-[12px] file:mr-2 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-2"
        />
        <p className="mt-1 text-[10px] text-muted">
          {photoRequired ? "本路线有点位要求拍照，请至少上传 1 张。" : "可选，最多 3 张。"}
        </p>
      </div>

      <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
        <label className="block text-[12px] font-medium text-ink-soft">
          路线备注
        </label>
        <textarea
          name="note"
          placeholder="选填：现场情况、交接事项"
          className="mt-2 min-h-20 w-full rounded-xl border border-line bg-paper/50 px-3.5 py-2.5 text-[14px] focus:border-ink/40 focus:outline-none"
        />
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
          <WarningCircle className="size-4" /> {state.error}
        </p>
      )}

      <SubmitButton
        size="lg"
        pendingText="提交中…"
        className="h-14 w-full text-[15px]"
      >
        <CheckCircle className="size-5" /> 提交点检结果
      </SubmitButton>
      <p className="pb-6 text-center text-[10px] text-muted">
        异常项提交后会自动生成维修工单，无需另行报修。
      </p>
    </form>
  );
}
