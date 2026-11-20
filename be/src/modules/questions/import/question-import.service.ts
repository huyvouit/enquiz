import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../../common/enums/role.enum.js';
import type { AuthUser } from '../../../common/types/auth-user.js';
import { questionFieldsFromDto } from '../question-fields.js';
import { Question } from '../schemas/question.schema.js';
import { csvRecords } from './csv.js';
import { checkQuestionRow, REQUIRED_COLUMNS } from './question-row.js';

export const IMPORT_MAX_ROWS = 500;
const PREVIEW_MAX = 50;

export interface ImportReport {
  dryRun: boolean;
  total: number;
  /** Rows that would be (dry run) or were saved as new questions. */
  created: number;
  /** Rows with a known externalId that updated an existing question (admin). */
  updated: number;
  skipped: { line: number; reason: string }[];
  errors: { line: number; messages: string[] }[];
  preview: {
    line: number;
    type: string;
    topic: string;
    gradeLevel: number;
    questionText: string;
  }[];
}

/** A saved row, for callers that build quizzes from the CSV (seed:content). */
export interface SavedRow {
  line: number;
  id: Types.ObjectId;
  quiz: string;
  quizEmoji: string;
  gradeLevel: number;
  topic: string;
}

/**
 * Same grade, type, text and answer content = duplicate. The content counts
 * because instructions such as "Sắp xếp thành câu đúng" repeat on purpose.
 */
const dupKey = (q: {
  questionText: string;
  type: string;
  gradeLevel: number;
  options?: string[];
  pairs?: { left: string; right: string }[];
  correctAnswer?: unknown;
}) =>
  JSON.stringify([
    q.gradeLevel,
    q.type,
    q.questionText.trim().replace(/\s+/g, ' ').toLowerCase(),
    q.options ?? null,
    q.pairs?.map((p) => [p.left, p.right]) ?? null,
    q.correctAnswer ?? null,
  ]).toLowerCase();

/**
 * Imports questions from CSV with the same rules as the form (plan 3.5).
 * Admin rows become system questions (createdBy = null) and may carry an
 * externalId (re-imports update them); teacher rows go to the teacher's bank.
 */
@Injectable()
export class QuestionImportService {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
  ) {}

  async import(
    csv: string,
    user: AuthUser,
    dryRun: boolean,
  ): Promise<{ report: ImportReport; saved: SavedRow[] }> {
    const { headers, records } = csvRecords(csv);
    const missing = REQUIRED_COLUMNS.filter(
      (c) => !headers.includes(c.toLowerCase()),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `File thiếu cột: ${missing.join(', ')}. Hãy dùng file mẫu.`,
      );
    }
    if (records.length === 0) {
      throw new BadRequestException('File không có dòng câu hỏi nào');
    }
    if (records.length > IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `Mỗi lần nhập tối đa ${IMPORT_MAX_ROWS} câu (file có ${records.length})`,
      );
    }

    const isAdmin = user.role === Role.ADMIN;
    const owner = isAdmin ? null : new Types.ObjectId(user.userId);
    const report: ImportReport = {
      dryRun,
      total: records.length,
      created: 0,
      updated: 0,
      skipped: [],
      errors: [],
      preview: [],
    };

    const checked = [];
    for (const r of records) {
      const res = await checkQuestionRow(r.values);
      if (!res.ok) report.errors.push({ line: r.line, messages: res.messages });
      else checked.push({ ...r, ...res });
    }

    // Duplicates: same text + type + grade, in the file or already in the bank.
    const existing = await this.questionModel
      .find(
        {
          createdBy: owner,
          questionText: { $in: checked.map((c) => c.content.questionText) },
        },
        {
          questionText: 1,
          type: 1,
          gradeLevel: 1,
          options: 1,
          pairs: 1,
          correctAnswer: 1,
        },
      )
      .lean();
    const inBank = new Map(existing.map((q) => [dupKey(q), q]));
    const byExternalId = new Map(
      isAdmin
        ? (
            await this.questionModel
              .find(
                {
                  externalId: {
                    $in: checked
                      .map((c) => c.values.externalid)
                      .filter(Boolean),
                  },
                },
                { externalId: 1 },
              )
              .lean()
          ).map((q) => [q.externalId!, q._id])
        : [],
    );
    const seenInFile = new Map<string, number>();

    const toCreate: { row: (typeof checked)[number]; doc: object }[] = [];
    const toUpdate: {
      row: (typeof checked)[number];
      id: Types.ObjectId;
      doc: object;
    }[] = [];
    for (const row of checked) {
      const key = dupKey({
        ...row.content,
        type: row.dto.type,
        gradeLevel: row.dto.gradeLevel,
      });
      const externalId = isAdmin
        ? row.values.externalid || undefined
        : undefined;
      const doc = {
        ...questionFieldsFromDto(row.dto),
        ...row.content,
        externalId,
        createdBy: owner,
      };
      const known = externalId ? byExternalId.get(externalId) : undefined;
      if (known) {
        toUpdate.push({ row, id: known, doc });
        continue;
      }
      const firstLine = seenInFile.get(key);
      if (firstLine !== undefined) {
        report.skipped.push({
          line: row.line,
          reason: `Trùng với dòng ${firstLine}`,
        });
        continue;
      }
      seenInFile.set(key, row.line);
      if (inBank.has(key)) {
        report.skipped.push({
          line: row.line,
          reason: 'Đã có trong kho câu hỏi',
        });
        continue;
      }
      toCreate.push({ row, doc });
    }

    report.created = toCreate.length;
    report.updated = toUpdate.length;
    report.preview = [...toCreate, ...toUpdate]
      .slice(0, PREVIEW_MAX)
      .map(({ row }) => ({
        line: row.line,
        type: row.dto.type,
        topic: row.dto.topic.trim(),
        gradeLevel: row.dto.gradeLevel,
        questionText: row.content.questionText,
      }));
    if (dryRun) return { report, saved: [] };

    const inserted = await this.questionModel.insertMany(
      toCreate.map((x) => x.doc),
    );
    for (const u of toUpdate) {
      await this.questionModel.updateOne({ _id: u.id }, { $set: u.doc });
    }
    const saved: SavedRow[] = [
      ...toCreate.map(({ row }, i) => ({ row, id: inserted[i]._id })),
      ...toUpdate.map(({ row, id }) => ({ row, id })),
    ]
      .sort((a, b) => a.row.line - b.row.line)
      .map(({ row, id }) => ({
        line: row.line,
        id,
        quiz: row.values.quiz ?? '',
        quizEmoji: row.values.quizemoji ?? '',
        gradeLevel: row.dto.gradeLevel,
        topic: row.dto.topic.trim(),
      }));
    return { report, saved };
  }
}
