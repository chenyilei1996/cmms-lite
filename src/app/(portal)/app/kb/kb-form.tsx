import { FloppyDisk, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import { CATEGORIES } from "@/lib/constants";
import {
  KB_CATEGORIES,
  KB_CATEGORY_KEYS,
  type KbCategory,
} from "@/lib/kb";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

type Option = { id: string; label: string };

export function KbForm({
  action,
  mode,
  canPublish,
  assets,
  faultCodes,
  article,
  sourceWorkOrderId,
  defaultTitle,
  defaultContent,
  submitted,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mode: "create" | "edit";
  canPublish: boolean;
  assets: Option[];
  faultCodes: Option[];
  article?: {
    id: string;
    title: string;
    summary: string | null;
    category: KbCategory;
    content: string;
    assetId: string | null;
    assetCategory: string | null;
    faultCodeId: string | null;
    tags: string;
    status: string;
  };
  sourceWorkOrderId?: string | null;
  defaultTitle?: string;
  defaultContent?: string;
  submitted?: {
    title?: string;
    summary?: string;
    category?: string;
    content?: string;
    assetId?: string;
    assetCategory?: string;
    faultCodeId?: string;
    tags?: string;
  };
}) {
  return (
    <form action={action} className="space-y-4">
      {article && <input type="hidden" name="id" value={article.id} />}
      {sourceWorkOrderId && (
        <input type="hidden" name="sourceWorkOrderId" value={sourceWorkOrderId} />
      )}

      <section className="card space-y-4 p-5 lg:p-6">
        <Field label="标题" required hint="现场一眼能看懂的描述">
          <Input
            name="title"
            required
            maxLength={120}
            defaultValue={submitted?.title ?? article?.title ?? defaultTitle ?? ""}
            placeholder="例如：注塑机液压油温过高报警处理"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="知识分类" required>
            <Select
              name="category"
              defaultValue={
                submitted?.category ?? article?.category ?? "fault_case"
              }
            >
              {KB_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {KB_CATEGORIES[key].label} · {KB_CATEGORIES[key].hint}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="标签" hint="逗号分隔，最多 8 个">
            <Input
              name="tags"
              defaultValue={submitted?.tags ?? article?.tags ?? ""}
              placeholder="油温,液压,密封圈"
            />
          </Field>
        </div>

        <Field label="摘要" hint="列表页展示，一句话说明适用场景">
          <Input
            name="summary"
            maxLength={200}
            defaultValue={
              submitted?.summary ?? article?.summary ?? ""
            }
            placeholder="例如：油温持续超过 55℃ 时，先查冷却水与滤芯，再判断油质"
          />
        </Field>

        <Field
          label="正文"
          required
          hint="空行分段；## 小标题；- 列表；1. 步骤"
        >
          <Textarea
            name="content"
            required
            rows={18}
            defaultValue={
              submitted?.content ?? article?.content ?? defaultContent ?? ""
            }
            placeholder={"## 现象\n...\n\n## 原因\n- ...\n\n## 处理步骤\n1. ..."}
            className="min-h-[320px] font-mono text-[12.5px] leading-relaxed"
          />
        </Field>
      </section>

      <section className="card space-y-4 p-5 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="适用设备" hint="可选，关联到具体单机">
            <Select
              name="assetId"
              defaultValue={submitted?.assetId ?? article?.assetId ?? ""}
            >
              <option value="">不指定设备</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="适用设备类别" hint="可选，同类设备通用">
            <Select
              name="assetCategory"
              defaultValue={
                submitted?.assetCategory ?? article?.assetCategory ?? ""
              }
            >
              <option value="">不指定类别</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="关联故障代码" hint="可选，便于故障统计联动">
            <Select
              name="faultCodeId"
              defaultValue={
                submitted?.faultCodeId ?? article?.faultCodeId ?? ""
              }
            >
              <option value="">不关联</option>
              {faultCodes.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          知识会出现在关联设备的一机一档和同设备工单详情中；标记设备类别后可跨同类设备复用。
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "create" ? (
          <>
            <SubmitButton>
              <FloppyDisk className="size-4" /> 保存草稿
            </SubmitButton>
            {canPublish && (
              <SubmitButton name="intent" value="publish" variant="secondary">
                <PaperPlaneTilt className="size-4" /> 直接发布
              </SubmitButton>
            )}
          </>
        ) : (
          <>
            <SubmitButton name="intent" value="save">
              <FloppyDisk className="size-4" /> 保存修改
            </SubmitButton>
            {canPublish && article?.status !== "published" && (
              <SubmitButton name="intent" value="publish" variant="secondary">
                <PaperPlaneTilt className="size-4" /> 发布
              </SubmitButton>
            )}
            {canPublish && article?.status === "published" && (
              <SubmitButton name="intent" value="draft" variant="secondary">
                转为草稿
              </SubmitButton>
            )}
            {canPublish && article?.status !== "archived" && (
              <SubmitButton name="intent" value="archive" variant="ghost">
                归档
              </SubmitButton>
            )}
          </>
        )}
        <span className="text-[11px] text-muted">
          {canPublish
            ? "发布后所有角色可检索查看。"
            : "保存草稿后由维修主管审核发布。"}
        </span>
      </div>

      {mode === "create" && !canPublish && (
        <input type="hidden" name="intent" value="draft" />
      )}
    </form>
  );
}
