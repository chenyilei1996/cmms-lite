import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { warehouses } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { SPARE_PART_CATEGORIES } from "@/lib/constants";
import {
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { createSparePart } from "@/server/spare-part-actions";

export const metadata = { title: "新建备件" };

export default async function NewSparePartPage() {
  await requireUser();
  const warehouseRows = await db
    .select({ id: warehouses.id, name: warehouses.name })
    .from(warehouses)
    .orderBy(asc(warehouses.code));

  return (
    <>
      <PageHeader
        eyebrow="New spare part"
        title="新建备件"
        description="建立备件主数据后，可在工单中直接领用并自动扣减库存。"
        actions={
          <LinkButton href="/app/spare-parts" variant="secondary">
            <ArrowLeft className="size-4" /> 返回台账
          </LinkButton>
        }
      />

      <form action={createSparePart} className="card max-w-3xl p-5 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="备件名称" required>
            <Input name="name" required placeholder="例如：哥林柱铜套" />
          </Field>
          <Field label="备件编码" hint="留空自动生成">
            <Input name="code" placeholder="SP-0001" />
          </Field>
          <Field label="类别">
            <Select name="category" defaultValue="机械件">
              {SPARE_PART_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="规格型号">
            <Input name="spec" placeholder="例如：MA2100 / 45×120" />
          </Field>
          <Field label="单位">
            <Input name="unit" defaultValue="件" placeholder="件 / 个 / 桶" />
          </Field>
          <Field label="品牌">
            <Input name="brand" placeholder="品牌或制造商" />
          </Field>
          <Field label="供应商">
            <Input name="supplier" placeholder="供应商名称" />
          </Field>
          <Field label="默认仓库">
            <Select name="warehouseId" defaultValue={warehouseRows[0]?.id ?? ""}>
              <option value="">暂不分配</option>
              {warehouseRows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="库位">
            <Input name="binCode" placeholder="例如：A-03-02" />
          </Field>
          <Field label="安全库存" hint="低于该值会提醒补货">
            <Input name="safetyStock" type="number" min={0} defaultValue={0} />
          </Field>
          <Field label="参考单价" hint="用于成本归集">
            <Input
              name="referencePrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
            />
          </Field>
          <Field label="备注" className="sm:col-span-2">
            <Textarea name="notes" placeholder="适用设备、替代型号、存放要求等" />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <LinkButton href="/app/spare-parts" variant="secondary">
            取消
          </LinkButton>
          <SubmitButton>保存备件</SubmitButton>
        </div>
      </form>
    </>
  );
}
