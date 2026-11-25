import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const HEADERS = [
  "设备编码",
  "设备名称",
  "类别",
  "层级",
  "状态",
  "关键等级",
  "上级编码",
  "位置编码",
  "安装位置",
  "责任人",
  "制造商",
  "供应商",
  "型号",
  "出厂编号",
  "购置日期",
  "质保到期",
  "购置成本",
  "折旧月数",
  "技术参数",
  "备注",
];

const SAMPLE = [
  [
    "AZ-1001",
    "冲压机 A 线",
    "冲压设备",
    "单机",
    "运行中",
    "A",
    "",
    "",
    "一号车间东侧",
    "张伟",
    "江苏锻压",
    "华东机电",
    "JC21-160",
    "SN2024001",
    "2024-03-01",
    "2027-03-01",
    "560000",
    "120",
    "额定压力=160T;功率=22kW",
    "冲压主力设备",
  ],
  [
    "AZ-1002",
    "冷却水泵",
    "动力设备",
    "单机",
    "待机",
    "B",
    "AZ-1001",
    "",
    "一号车间北侧",
    "李强",
    "南方泵业",
    "",
    "CDL-32",
    "SN2024002",
    "2023-06-15",
    "2026-06-15",
    "18000",
    "60",
    "",
    "",
  ],
];

/** 设备导入 CSV 模板下载。 */
export async function GET() {
  const csv = toCsv(HEADERS, SAMPLE);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        'attachment; filename="asset-import-template.csv"',
      "cache-control": "no-store",
    },
  });
}
