"use client";

import { Check, WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import {
  updateAssetProfile,
  type AssetProfileState,
} from "@/server/asset-actions";
import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

export function AssetProfileForm({
  asset,
  specsText,
}: {
  asset: {
    id: string;
    installLocation: string | null;
    responsibleName: string | null;
    vendor: string | null;
    purchaseCost: string | null;
    depreciationMonths: number | null;
    notes: string | null;
  };
  specsText: string;
}) {
  const [state, action] = useActionState<AssetProfileState, FormData>(
    updateAssetProfile,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={asset.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="详细安装位置">
          <Input
            name="installLocation"
            defaultValue={asset.installLocation ?? ""}
            placeholder="如 一号车间 A 线 3 号工位"
          />
        </Field>
        <Field label="设备责任人">
          <Input
            name="responsibleName"
            defaultValue={asset.responsibleName ?? ""}
          />
        </Field>
        <Field label="供应商">
          <Input name="vendor" defaultValue={asset.vendor ?? ""} />
        </Field>
        <Field label="购置金额（元）">
          <Input
            name="purchaseCost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={asset.purchaseCost ?? ""}
          />
        </Field>
        <Field label="折旧年限（月）">
          <Input
            name="depreciationMonths"
            type="number"
            min={0}
            defaultValue={asset.depreciationMonths ?? ""}
          />
        </Field>
      </div>
      <Field label="技术参数" hint="每行一项，格式 名称=值">
        <Textarea name="specs" defaultValue={specsText} className="min-h-32" />
      </Field>
      <Field label="备注">
        <Textarea name="notes" defaultValue={asset.notes ?? ""} />
      </Field>

      {state?.error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
          <WarningCircle className="size-4" /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-2 rounded-xl bg-mint-soft px-3 py-2.5 text-[12px] text-mint">
          <Check className="size-4" /> 已保存
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton>保存档案</SubmitButton>
      </div>
    </form>
  );
}
