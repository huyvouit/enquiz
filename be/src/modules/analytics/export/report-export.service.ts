import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { createRequire } from 'node:module';
import path from 'node:path';
import pdfmake from 'pdfmake';
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces.js';
import { formatVnDateTime, vnDateKey } from '../../../common/utils/vn-time.js';
import type { AssignmentDetail } from '../../assignments/assignments.mapper.js';
import { stripVietnamese } from '../../classes/class-rules.js';
import { toTenScale } from '../analytics-rules.js';
import { classLabel, stripEmoji } from './pdf-text.js';
import type {
  DateRange,
  GradeCellState,
  Gradebook,
  QuestionHeatmap,
  StudentReport,
} from '../analytics.views.js';

export type ExportFormat = 'xlsx' | 'pdf';

export interface ExportFile {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const STATE_LABEL: Record<GradeCellState, string> = {
  on_time: 'Đúng hạn',
  late: 'Nộp muộn',
  pending: 'Chưa nộp (còn hạn)',
  missing: 'Chưa nộp (quá hạn)',
  not_assigned: 'Không giao',
};
const SKILL_LABEL: Record<string, string> = {
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  listening: 'Nghe',
};
const LATE_FILL = 'FFFFE4C4';
const MISSING_FILL = 'FFFDE2E2';
const HEADER_FILL = 'FFE0E7FF';

// Roboto ships with pdfmake and covers Vietnamese diacritics.
const require = createRequire(import.meta.url);
const ROBOTO_DIR = path.join(
  path.dirname(require.resolve('pdfmake/package.json')),
  'fonts',
  'Roboto',
);
pdfmake.addFonts({
  Roboto: {
    normal: path.join(ROBOTO_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(ROBOTO_DIR, 'Roboto-Medium.ttf'),
    italics: path.join(ROBOTO_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(ROBOTO_DIR, 'Roboto-MediumItalic.ttf'),
  },
});
// Reports never load remote or arbitrary local resources.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((p: string) =>
  path.resolve(p).startsWith(ROBOTO_DIR),
);

const slug = (text: string) =>
  stripVietnamese(text).replace(/\s+/g, '-').slice(0, 40) || 'bao-cao';
const rangeLabel = (r: DateRange) =>
  `${formatVnDateTime(r.from).slice(0, 10)} – ${formatVnDateTime(r.to).slice(0, 10)}`;
const dash = (v: number | null) => (v === null ? '–' : v);

/** Excel and PDF files for teachers (plan D10). Data comes from AnalyticsService. */
@Injectable()
export class ReportExportService {
  // ---------- Gradebook ----------

  async gradebook(g: Gradebook, format: ExportFormat): Promise<ExportFile> {
    const base = `bang-diem-${slug(g.class.name)}-${vnDateKey(g.generatedAt)}`;
    const buffer =
      format === 'xlsx'
        ? await this.gradebookXlsx(g)
        : await this.gradebookPdf(g);
    return {
      buffer,
      fileName: `${base}.${format}`,
      contentType: CONTENT_TYPES[format],
    };
  }

  private async gradebookXlsx(g: Gradebook): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EnQuiz';
    const ws = wb.addWorksheet('Bảng điểm');

    const fixed = ['STT', 'Họ tên', 'Tên đăng nhập'];
    const tail = [
      'TB (100)',
      'TB (10)',
      'Đúng hạn',
      'Muộn',
      'Chưa nộp',
      'Cấp',
      'XP',
    ];
    const header = [
      ...fixed,
      ...g.assignments.map(
        (a) => `${a.title}\n(hạn ${formatVnDateTime(a.dueDate).slice(0, 10)})`,
      ),
      ...tail,
    ];
    ws.addRow([`BẢNG ĐIỂM – ${g.class.name}`]).font = { bold: true, size: 14 };
    ws.addRow([
      `Giáo viên: ${g.class.teacherName}` +
        (g.class.schoolName ? ` · Trường: ${g.class.schoolName}` : '') +
        ` · Kỳ: ${rangeLabel(g.range)}`,
    ]);
    ws.addRow([]);
    const headerRow = ws.addRow(header);
    headerRow.font = { bold: true };
    headerRow.alignment = {
      wrapText: true,
      vertical: 'middle',
      horizontal: 'center',
    };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL },
      };
    });
    headerRow.height = 42;

    for (const r of g.rows) {
      const row = ws.addRow([
        r.index,
        r.student.fullName,
        r.student.username,
        ...r.cells.map((c) =>
          c.score !== null ? c.score : c.state === 'not_assigned' ? '' : '–',
        ),
        r.averageScore ?? '',
        r.average10 ?? '',
        r.onTime,
        r.late,
        r.notSubmitted,
        r.level,
        r.xp,
      ]);
      r.cells.forEach((c, i) => {
        const cell = row.getCell(fixed.length + i + 1);
        cell.alignment = { horizontal: 'center' };
        const argb =
          c.state === 'late'
            ? LATE_FILL
            : c.state === 'missing'
              ? MISSING_FILL
              : null;
        if (argb)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      });
    }
    const avgRow = ws.addRow([
      '',
      'Trung bình từng bài',
      '',
      ...g.assignmentAverages.map((v) => v ?? ''),
    ]);
    avgRow.font = { italic: true };

    ws.addRow([]);
    ws.addRow([
      'Ghi chú: ô cam = nộp muộn, ô hồng = quá hạn chưa nộp, "–" = chưa nộp, ô trống = không giao. TB chỉ tính bài đã nộp.',
    ]);

    ws.columns.forEach((col, i) => {
      col.width = i === 0 ? 6 : i === 1 ? 26 : i === 2 ? 16 : 14;
    });
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];

    const info = wb.addWorksheet('Thông tin');
    info.addRows([
      ['Lớp', g.class.name],
      ['Khối', g.class.gradeLevel],
      ['Trường', g.class.schoolName ?? ''],
      ['Giáo viên', g.class.teacherName],
      ['Kỳ báo cáo', rangeLabel(g.range)],
      ['Ngày xuất', formatVnDateTime(g.generatedAt)],
      ['Thang điểm', 'Điểm mỗi bài trên thang 100; TB (10) = TB (100) / 10'],
    ]);
    info.getColumn(1).width = 16;
    info.getColumn(2).width = 60;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private gradebookPdf(g: Gradebook): Promise<Buffer> {
    const small = g.assignments.length > 6;
    const cellText = (state: GradeCellState, score: number | null): string => {
      if (state === 'not_assigned') return '';
      if (score === null) return '–';
      return state === 'late' ? `${score} (M)` : String(score);
    };
    const header: TableCell[] = [
      'STT',
      'Họ tên',
      ...g.assignments.map((a) => ({
        text: `${a.title}\n${formatVnDateTime(a.dueDate).slice(0, 5)}`,
        fontSize: small ? 6.5 : 8,
      })),
      'TB (100)',
      'TB (10)',
      'Muộn',
      'Chưa nộp',
    ].map((c) =>
      typeof c === 'string' ? { text: c, bold: true } : { ...c, bold: true },
    );
    const body: TableCell[][] = [
      header,
      ...g.rows.map((r) => [
        String(r.index),
        r.student.fullName,
        ...r.cells.map((c) => cellText(c.state, c.score)),
        String(dash(r.averageScore)),
        String(dash(r.average10)),
        String(r.late),
        String(r.notSubmitted),
      ]),
      [
        '',
        { text: 'TB từng bài', italics: true },
        ...g.assignmentAverages.map((v) => String(dash(v))),
        '',
        '',
        '',
        '',
      ],
    ];
    return this.pdf({
      title: `Bảng điểm ${g.class.name}`,
      orientation: 'landscape',
      fontSize: small ? 7.5 : 9,
      header: [
        g.class.schoolName ?? '',
        `BẢNG ĐIỂM TIẾNG ANH – ${g.class.name.toUpperCase()}`,
        `Giáo viên: ${g.class.teacherName} · Kỳ: ${rangeLabel(g.range)} · Xuất lúc ${formatVnDateTime(g.generatedAt)}`,
      ],
      content: [
        {
          table: {
            headerRows: 1,
            widths: [22, 110, ...g.assignments.map(() => '*'), 36, 32, 30, 36],
            body,
          },
          layout: 'lightHorizontalLines',
        },
        {
          text: '(M) = nộp muộn · "–" = chưa nộp · ô trống = không giao · TB chỉ tính bài đã nộp',
          fontSize: 7,
          italics: true,
          margin: [0, 6, 0, 0],
        },
        signature(g.class.teacherName),
      ],
    });
  }

  // ---------- One homework ----------

  async assignment(
    detail: AssignmentDetail,
    heatmap: QuestionHeatmap,
    format: ExportFormat,
  ): Promise<ExportFile> {
    const title = detail.quiz?.title ?? 'bai-tap';
    const base = `ket-qua-${slug(title)}-${slug(detail.className)}`;
    const buffer =
      format === 'xlsx'
        ? await this.assignmentXlsx(detail, heatmap)
        : await this.assignmentPdf(detail, heatmap);
    return {
      buffer,
      fileName: `${base}.${format}`,
      contentType: CONTENT_TYPES[format],
    };
  }

  private async assignmentXlsx(
    d: AssignmentDetail,
    h: QuestionHeatmap,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Nộp bài');
    ws.addRow([`${d.quiz?.title ?? ''} – ${d.className}`]).font = {
      bold: true,
      size: 14,
    };
    ws.addRow([`Hạn nộp: ${formatVnDateTime(d.dueDate)}`]);
    ws.addRow([]);
    const head = ws.addRow([
      'STT',
      'Họ tên',
      'Trạng thái',
      'Điểm (100)',
      'Điểm (10)',
      'Nộp lúc',
      'Số lần làm',
    ]);
    head.font = { bold: true };
    d.submissions.forEach((s, i) => {
      ws.addRow([
        i + 1,
        s.student.fullName,
        STATE_LABEL[s.state],
        s.score ?? '',
        toTenScale(s.score) ?? '',
        s.submittedAt ? formatVnDateTime(s.submittedAt) : '',
        s.attempts,
      ]);
    });
    ws.columns.forEach((c, i) => (c.width = [6, 26, 20, 12, 10, 18, 12][i]));

    const qs = wb.addWorksheet('Từng câu');
    const qHead = qs.addRow([
      'Câu',
      'Nội dung',
      'Đáp án đúng',
      '% đúng',
      'Số em làm',
      'Sai phổ biến',
    ]);
    qHead.font = { bold: true };
    for (const q of h.questions) {
      qs.addRow([
        q.index,
        q.questionText,
        q.correctAnswer,
        q.correctRate ?? '',
        q.answered,
        q.commonWrongAnswer
          ? `${q.commonWrongAnswer.answer} (${q.commonWrongAnswer.count} em)`
          : '',
      ]);
    }
    qs.columns.forEach((c, i) => (c.width = [6, 40, 24, 10, 10, 30][i]));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private assignmentPdf(
    d: AssignmentDetail,
    h: QuestionHeatmap,
  ): Promise<Buffer> {
    return this.pdf({
      title: `Kết quả ${d.quiz?.title ?? ''}`,
      orientation: 'portrait',
      fontSize: 9,
      header: [
        `KẾT QUẢ BÀI TẬP: ${d.quiz?.title ?? '(quiz đã xoá)'}`,
        `${classLabel(d.className)} · Hạn nộp ${formatVnDateTime(d.dueDate)} · Đúng hạn ${d.counts.onTime}/${d.counts.assigned}, muộn ${d.counts.late}, chưa nộp ${d.counts.pending + d.counts.missing}`,
      ],
      content: [
        {
          table: {
            headerRows: 1,
            widths: [22, '*', 90, 40, 80],
            body: [
              ['STT', 'Họ tên', 'Trạng thái', 'Điểm', 'Nộp lúc'].map((t) => ({
                text: t,
                bold: true,
              })),
              ...d.submissions.map((s, i) => [
                String(i + 1),
                s.student.fullName,
                STATE_LABEL[s.state],
                String(dash(s.score)),
                s.submittedAt ? formatVnDateTime(s.submittedAt) : '',
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        {
          text: 'Tỉ lệ đúng từng câu (lần làm đầu tiên)',
          bold: true,
          margin: [0, 14, 0, 4],
        },
        {
          table: {
            headerRows: 1,
            widths: [24, '*', 90, 36, 110],
            body: [
              ['Câu', 'Nội dung', 'Đáp án đúng', '% đúng', 'Sai phổ biến'].map(
                (t) => ({ text: t, bold: true }),
              ),
              ...h.questions.map((q) => [
                String(q.index),
                q.questionText,
                q.correctAnswer,
                String(dash(q.correctRate)),
                q.commonWrongAnswer
                  ? `${q.commonWrongAnswer.answer} (${q.commonWrongAnswer.count})`
                  : '',
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        signature(''),
      ],
    });
  }

  // ---------- Student report ----------

  async studentReport(r: StudentReport): Promise<ExportFile> {
    const buffer = await this.pdf({
      title: `Phiếu tiến độ ${r.student.fullName}`,
      orientation: 'portrait',
      fontSize: 10,
      header: [
        'PHIẾU TIẾN ĐỘ HỌC TIẾNG ANH',
        `${r.student.fullName} · ${classLabel(r.class.name)} · Kỳ: ${rangeLabel(r.range)}`,
      ],
      content: [
        {
          columns: [
            kv('Cấp độ', String(r.student.level)),
            kv('Tổng XP', String(r.student.xp)),
            kv('XP trong kỳ', String(r.xpInRange)),
            kv('Trạm đã mở', `${r.map.unlocked}/${r.map.totalStations}`),
          ],
          columnGap: 8,
        },
        { text: 'Bài tập về nhà', bold: true, margin: [0, 12, 0, 4] },
        {
          text: `Đúng hạn ${r.homework.counts.onTime} · Muộn ${r.homework.counts.late} · Chưa nộp ${r.homework.counts.pending + r.homework.counts.missing} (trên ${r.homework.counts.assigned} bài)`,
        },
        ...(r.homework.incomplete.length > 0
          ? [
              {
                ul: r.homework.incomplete.map(
                  (x) =>
                    `${x.quizTitle} – hạn ${formatVnDateTime(x.dueDate)} (${STATE_LABEL[x.state]})`,
                ),
                margin: [0, 4, 0, 0],
              } as Content,
            ]
          : []),
        {
          text: 'Theo chủ đề (lần làm đầu tiên)',
          bold: true,
          margin: [0, 12, 0, 4],
        },
        r.topics.length === 0
          ? { text: 'Chưa có dữ liệu trong kỳ.', italics: true }
          : {
              table: {
                headerRows: 1,
                widths: ['*', 60, 60, 60],
                body: [
                  ['Chủ đề', '% đúng của em', 'TB lớp', 'Số câu'].map((t) => ({
                    text: t,
                    bold: true,
                  })),
                  ...r.topics.map((t) => [
                    t.topic,
                    `${t.correctRate}%`,
                    t.classRate === null ? '–' : `${t.classRate}%`,
                    String(t.answered),
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
        ...(r.skills.length > 0
          ? [
              {
                text: r.skills
                  .map(
                    (s) =>
                      `${SKILL_LABEL[s.skill] ?? s.skill}: ${s.correctRate}%` +
                      (s.classRate === null ? '' : ` (lớp ${s.classRate}%)`),
                  )
                  .join(' · '),
                margin: [0, 6, 0, 0],
              } as Content,
            ]
          : []),
        { text: 'Bài làm gần đây', bold: true, margin: [0, 12, 0, 4] },
        r.history.length === 0
          ? { text: 'Chưa có bài làm trong kỳ.', italics: true }
          : {
              table: {
                headerRows: 1,
                widths: ['*', 50, 90],
                body: [
                  ['Bài', 'Điểm', 'Thời gian'].map((t) => ({
                    text: t,
                    bold: true,
                  })),
                  ...r.history
                    .slice(0, 12)
                    .map((x) => [
                      `${x.quizTitle}${x.homework ? ' (bài tập)' : ''}`,
                      String(x.score),
                      formatVnDateTime(x.completedAt),
                    ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
        signature(''),
      ],
    });
    return {
      buffer,
      fileName: `phieu-tien-do-${slug(r.student.fullName)}-${vnDateKey(new Date())}.pdf`,
      contentType: CONTENT_TYPES.pdf,
    };
  }

  // ---------- PDF plumbing ----------

  private async pdf(opts: {
    title: string;
    orientation: 'portrait' | 'landscape';
    fontSize: number;
    header: string[];
    content: Content[];
  }): Promise<Buffer> {
    const doc: TDocumentDefinitions = {
      info: { title: opts.title, creator: 'EnQuiz' },
      pageSize: 'A4',
      pageOrientation: opts.orientation,
      pageMargins: [32, 36, 32, 40],
      defaultStyle: { font: 'Roboto', fontSize: opts.fontSize },
      footer: (current, total) => ({
        text: `Trang ${current}/${total}`,
        alignment: 'right',
        fontSize: 7,
        margin: [0, 12, 32, 0],
      }),
      content: [
        ...opts.header.filter(Boolean).map((text, i): Content => ({
          text,
          bold: i <= 1,
          fontSize:
            i === 1 || (opts.header.length === 2 && i === 0)
              ? 13
              : opts.fontSize,
          alignment: 'center',
          margin: [0, 0, 0, 3],
        })),
        { text: '', margin: [0, 0, 0, 8] },
        ...opts.content,
      ],
    };
    const output = pdfmake.createPdf(stripEmoji(doc));
    return Buffer.from(await output.getBuffer());
  }
}

function kv(label: string, value: string): Content {
  return {
    stack: [
      { text: label, fontSize: 8, color: '#555555' },
      { text: value, fontSize: 14, bold: true },
    ],
  };
}

function signature(name: string): Content {
  return {
    columns: [
      { text: '' },
      {
        stack: [
          { text: 'Giáo viên', bold: true, alignment: 'center' },
          {
            text: '(ký, ghi rõ họ tên)',
            italics: true,
            fontSize: 8,
            alignment: 'center',
          },
          { text: name, alignment: 'center', margin: [0, 36, 0, 0] },
        ],
        width: 180,
      },
    ],
    margin: [0, 24, 0, 0],
    unbreakable: true,
  };
}
