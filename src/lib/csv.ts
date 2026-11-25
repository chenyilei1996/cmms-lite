/** 轻量 CSV 工具：支持 BOM、CRLF、引号包裹与转义双引号。 */

export type CsvRecord = Record<string, unknown>;

/** 解析上限，防止超大文件撑爆内存。 */
export const CSV_MAX_ROWS = 20000;
export const CSV_MAX_COLUMNS = 64;
const MAX_CELL_LENGTH = 4000;

export class CsvLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvLimitError";
  }
}

/** 解析 CSV 文本，首行为表头；返回带隐藏行号的记录。 */
export function parseCsv(text: string): Array<CsvRecord & { __line: number }> {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows = tokenize(normalized);
  if (rows.length === 0) return [];

  const header = rows[0]
    .slice(0, CSV_MAX_COLUMNS)
    .map((cell) => cell.trim().toLowerCase());
  if (header.every((cell) => cell === "")) return [];

  const records: Array<CsvRecord & { __line: number }> = [];
  for (let i = 1; i < rows.length; i += 1) {
    if (records.length >= CSV_MAX_ROWS) {
      throw new CsvLimitError(`单次最多导入 ${CSV_MAX_ROWS} 行，请拆分文件`);
    }
    const cells = rows[i];
    if (cells.every((cell) => cell.trim() === "")) continue;
    const record: CsvRecord & { __line: number } = { __line: i + 1 };
    header.forEach((key, index) => {
      if (!key) return;
      const value = (cells[index] ?? "").trim();
      record[key] = value.length > MAX_CELL_LENGTH ? value.slice(0, MAX_CELL_LENGTH) : value;
    });
    records.push(record);
  }
  return records;
}

function tokenize(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** 生成带 BOM 的 CSV 文本，并对公式注入做转义，方便 Excel 直接打开。 */
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  const escape = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? "" : String(value);
    // 仅对字符串做公式转义，避免把负数等合法数值也加上前缀
    if (typeof value === "string" && FORMULA_PREFIX.test(text)) {
      text = `'${text}`;
    }
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
