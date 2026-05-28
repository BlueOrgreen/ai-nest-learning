const REQUIRED_HEADERS = ['name', 'price', 'stock'] as const;
const OPTIONAL_HEADERS = ['status', 'description'] as const;
const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

export interface ParsedProductRow {
  row: number;
  name: string;
  price: number;
  stock: number;
  status?: string;
  description?: string;
}

export interface CsvParseFailure {
  message: string;
}

export function parseProductCsv(
  content: string,
): { rows: ParsedProductRow[] } | CsvParseFailure {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { message: 'CSV 文件为空' };
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { message: 'CSV 至少需要表头与一行数据' };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { message: `CSV 表头缺少必填列: ${missing.join(', ')}` };
  }

  const unknown = headers.filter(
    (h) => !ALL_HEADERS.includes(h as (typeof ALL_HEADERS)[number]),
  );
  if (unknown.length > 0) {
    return { message: `CSV 表头包含未知列: ${unknown.join(', ')}` };
  }

  const rows: ParsedProductRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = (values[idx] ?? '').trim();
    });

    rows.push({
      row: i + 1,
      name: record.name ?? '',
      price: Number(record.price),
      stock: Number.parseInt(record.stock ?? '', 10),
      status: record.status || undefined,
      description: record.description || undefined,
    });
  }

  return { rows };
}

/** 简易 CSV 行解析（支持双引号包裹字段） */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}
