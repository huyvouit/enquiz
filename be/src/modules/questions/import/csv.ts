/**
 * Minimal RFC 4180 CSV reader: quoted fields, "" escapes, newlines inside
 * quotes, CRLF/LF, a UTF-8 BOM, and "," or ";" (Excel in some locales saves
 * with ";"). The delimiter is detected from the header line.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines (e.g. the trailing newline, or ";;;" rows from Excel).
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Rows as objects keyed by the (trimmed, lower-cased) header names. */
export function csvRecords(text: string): {
  headers: string[];
  records: { line: number; values: Record<string, string> }[];
} {
  const [header = [], ...rest] = parseCsv(text);
  const headers = header.map((h) => h.trim().toLowerCase());
  return {
    headers,
    records: rest.map((cells, i) => ({
      // 1-based spreadsheet row number (the header is row 1).
      line: i + 2,
      values: Object.fromEntries(
        headers.map((h, j) => [h, (cells[j] ?? '').trim()]),
      ),
    })),
  };
}
