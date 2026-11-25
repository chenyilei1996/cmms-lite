"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { createAsset, type AssetFormState } from "@/server/asset-actions";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { UnsavedChangesGuard } from "@/components/unsaved-guard";
import { ASSET_LEVEL, ASSET_LEVEL_ORDER, ASSET_STATUS, CATEGORIES } from "@/lib/constants";

export function AssetForm({
  locations,
  parents,
  initialParentId = "",
  initialLevel = "machine",
}: {
  locations: { id: string; name: string }[];
  parents: { id: string; code: string; name: string; level: string }[];
  initialParentId?: string;
  initialLevel?: string;
}) {
  const [state, action] = useActionState<AssetFormState, FormData>(
    createAsset,
    {},
  );

  return (
    <form id="asset-create-form" action={action} className="space-y-4">
      <UnsavedChangesGuard formId="asset-create-form" />
      <div className="card p-5 lg:p-6">
        <p className="label-mono mb-4">基本信息</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="设备编码" required hint="如 EQ-0011">
            <Input name="code" placeholder="EQ-0011" required />
          </Field>
          <Field label="设备名称" required>
            <Input name="name" placeholder="如 三号注塑机" required />
          </Field>
          <Field label="设备类别" required>
            <Select name="category" defaultValue={CATEGORIES[0]}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="层级">
            <Select name="level" defaultValue={initialLevel}>
              {ASSET_LEVEL_ORDER.map((level) => (
                <option key={level} value={level}>
                  {ASSET_LEVEL[level].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="上级节点">
            <Select name="parentId" defaultValue={initialParentId}>
              <option value="">不挂上级</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {ASSET_LEVEL[parent.level]?.label} · {parent.code} {parent.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="安装位置">
            <Select name="locationId" defaultValue="">
              <option value="">暂不分配</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="详细安装位置">
            <Input name="installLocation" placeholder="如 一号车间 A 线 3 号工位" />
          </Field>
          <Field label="设备责任人">
            <Input name="responsibleName" placeholder="如 李师傅" />
          </Field>
          <Field label="关键度">
            <Select name="criticality" defaultValue="B">
              <option value="A">A 类 · 关键设备</option>
              <option value="B">B 类 · 重要设备</option>
              <option value="C">C 类 · 一般设备</option>
            </Select>
          </Field>
          <Field label="初始状态">
            <Select name="status" defaultValue="in_service">
              {Object.entries(ASSET_STATUS).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="card p-5 lg:p-6">
        <p className="label-mono mb-4">出厂信息</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="制造商">
            <Input name="manufacturer" placeholder="如 海天" />
          </Field>
          <Field label="供应商">
            <Input name="vendor" placeholder="如 海天华南服务商" />
          </Field>
          <Field label="型号">
            <Input name="model" placeholder="如 MA2100" />
          </Field>
          <Field label="序列号">
            <Input name="serialNo" placeholder="设备出厂序列号" />
          </Field>
          <Field label="采购日期">
            <Input name="purchaseDate" type="date" />
          </Field>
          <Field label="保修截止">
            <Input name="warrantyUntil" type="date" />
          </Field>
          <Field label="购置金额（元）">
            <Input name="purchaseCost" type="number" min={0} step="0.01" placeholder="选填" />
          </Field>
          <Field label="折旧年限（月）">
            <Input name="depreciationMonths" type="number" min={0} placeholder="如 120" />
          </Field>
        </div>
        <Field label="技术参数" className="mt-4" hint="每行一项，格式 名称=值">
          <Textarea
            name="specs"
            placeholder={"额定功率=37kW\n锁模力=2100kN\n油温上限=55℃"}
            className="min-h-24"
          />
        </Field>
        <Field label="备注" className="mt-4">
          <Textarea name="notes" placeholder="运行班次、注意事项、历史大修等" />
        </Field>
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
          <WarningCircle className="size-4" /> {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <SubmitButton size="lg">保存并生成二维码</SubmitButton>
      </div>
    </form>
  );
}
