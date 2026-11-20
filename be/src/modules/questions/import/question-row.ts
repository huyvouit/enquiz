import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { QuestionDto } from '../dto/question.dto.js';
import {
  assertValidQuestionContent,
  type QuestionContent,
} from '../question-content.validator.js';
import { QuestionType } from '../question-types.js';

/**
 * CSV columns (header names are case-insensitive). Lists inside a cell are
 * separated by "|"; a matching pair is written "left=right".
 *
 * | column        | multiple_choice | fill_in_blank            | ordering             | matching          |
 * | options       | Dog|Cat|Duck    | word bank (optional)     | –                    | –                 |
 * | correctAnswer | Dog             | cat|kitten (accepted)    | I|like|cats (order)  | –                 |
 * | pairs         | –               | –                        | –                    | 🐶=dog|🐱=cat     |
 */
export const CSV_COLUMNS = [
  'type',
  'topic',
  'gradeLevel',
  'skill',
  'questionText',
  'options',
  'correctAnswer',
  'pairs',
  'audioText',
  'mediaUrl',
  'explanation',
  'tags',
  'yleLevel',
  'unit',
  'externalId',
  'quiz',
  'quizEmoji',
] as const;
export const REQUIRED_COLUMNS = ['type', 'topic', 'gradeLevel', 'questionText'];

const TYPE_ALIASES: Record<string, QuestionType> = {
  multiple_choice: QuestionType.MULTIPLE_CHOICE,
  mc: QuestionType.MULTIPLE_CHOICE,
  matching: QuestionType.MATCHING,
  match: QuestionType.MATCHING,
  fill_in_blank: QuestionType.FILL_IN_BLANK,
  fill: QuestionType.FILL_IN_BLANK,
  ordering: QuestionType.ORDERING,
  order: QuestionType.ORDERING,
};

/** Which CSV column a DTO property comes from (for error messages). */
const COLUMN_OF: Record<string, string> = {
  acceptedAnswers: 'correctAnswer',
  orderedItems: 'correctAnswer',
};

const VN_CONSTRAINT: Record<string, string> = {
  isInt: 'phải là số nguyên',
  min: 'quá nhỏ',
  max: 'quá lớn',
  isIn: 'giá trị không hợp lệ',
  isEnum: 'giá trị không hợp lệ',
  isString: 'đang trống',
  isArray: 'đang trống',
  arrayMinSize: 'thiếu phần tử',
  arrayMaxSize: 'quá nhiều phần tử',
  minLength: 'đang trống',
  maxLength: 'quá dài',
  matches: 'không hợp lệ',
  isDefined: 'đang trống',
};

const list = (v: string | undefined) =>
  (v ?? '')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);

/** A cell value keyed by column name, whatever case the header used. */
const cell = (values: Record<string, string>, column: string) =>
  values[column.toLowerCase()] ?? '';

/** Turns one CSV record into the same plain body the question form sends. */
export function rowToQuestionBody(
  values: Record<string, string>,
): Record<string, unknown> {
  const rawType = cell(values, 'type').toLowerCase();
  const type = TYPE_ALIASES[rawType] ?? rawType;
  const optional = (column: string) => cell(values, column) || undefined;
  const body: Record<string, unknown> = {
    type,
    topic: cell(values, 'topic'),
    gradeLevel: Number(cell(values, 'gradeLevel')),
    skill: optional('skill'),
    questionText: cell(values, 'questionText'),
    audioText: optional('audioText'),
    mediaUrl: optional('mediaUrl'),
    explanation: optional('explanation'),
    tags: list(cell(values, 'tags')),
    yleLevel: optional('yleLevel'),
    unit: optional('unit'),
  };
  const answer = cell(values, 'correctAnswer');
  switch (type) {
    case QuestionType.MULTIPLE_CHOICE:
      body.options = list(cell(values, 'options'));
      body.correctAnswer = answer;
      break;
    case QuestionType.FILL_IN_BLANK: {
      body.acceptedAnswers = list(answer);
      const bank = list(cell(values, 'options'));
      if (bank.length > 0) body.options = bank;
      break;
    }
    case QuestionType.ORDERING:
      body.orderedItems = list(answer);
      break;
    case QuestionType.MATCHING:
      body.pairs = list(cell(values, 'pairs')).map((p) => {
        const at = p.indexOf('=');
        return at < 0
          ? { left: p, right: '' }
          : { left: p.slice(0, at).trim(), right: p.slice(at + 1).trim() };
      });
      break;
  }
  return body;
}

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const column = COLUMN_OF[e.property] ?? (parent || e.property);
    const own = Object.keys(e.constraints ?? {}).map(
      (k) => `Cột ${column}: ${VN_CONSTRAINT[k] ?? 'không hợp lệ'}`,
    );
    return [...own, ...flatten(e.children ?? [], parent || e.property)];
  });
}

export type RowCheck =
  | { ok: true; dto: QuestionDto; content: QuestionContent }
  | { ok: false; messages: string[] };

/** Same rules as the question form: DTO validation, then content rules. */
export async function checkQuestionRow(
  values: Record<string, string>,
): Promise<RowCheck> {
  const dto = plainToInstance(QuestionDto, rowToQuestionBody(values));
  const errors = await validate(dto, { whitelist: true });
  if (errors.length > 0) {
    return { ok: false, messages: [...new Set(flatten(errors))] };
  }
  try {
    return { ok: true, dto, content: assertValidQuestionContent(dto) };
  } catch (err) {
    return { ok: false, messages: [(err as Error).message] };
  }
}
