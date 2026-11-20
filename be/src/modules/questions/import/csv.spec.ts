import { csvRecords, parseCsv } from './csv.js';

describe('parseCsv', () => {
  it('reads quotes, escaped quotes, newlines in quotes and CRLF', () => {
    const text = '﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n2,"line1\nline2",\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x, y', 'say "hi"'],
      ['2', 'line1\nline2', ''],
    ]);
  });

  it('detects ";" from the header (Excel in some locales)', () => {
    expect(parseCsv('type;topic\nmc;Animals, Pets\n;;\n')).toEqual([
      ['type', 'topic'],
      ['mc', 'Animals, Pets'],
    ]);
  });

  it('keys records by header and keeps spreadsheet line numbers', () => {
    const { headers, records } = csvRecords('Type , Topic\nmc,Animals\nfill\n');
    expect(headers).toEqual(['type', 'topic']);
    expect(records).toEqual([
      { line: 2, values: { type: 'mc', topic: 'Animals' } },
      { line: 3, values: { type: 'fill', topic: '' } },
    ]);
  });
});
