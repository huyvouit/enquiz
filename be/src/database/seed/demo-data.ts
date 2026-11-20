import { Role } from '../../common/enums/role.enum.js';
import {
  QuestionSkill,
  QuestionType,
} from '../../modules/questions/question-types.js';

/**
 * Demo content so a fresh install is playable immediately.
 * Emojis stand in for images, so no media files are needed.
 */

export const DEMO_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    fullName: 'Quản trị viên',
    role: Role.ADMIN,
  },
  {
    username: 'teacher',
    password: 'teacher123',
    fullName: 'Cô Lan',
    role: Role.TEACHER,
  },
  {
    username: 'student',
    password: 'student123',
    fullName: 'Bé An',
    role: Role.STUDENT,
    gradeLevel: 1,
  },
] as const;

interface DemoQuestion {
  type: QuestionType;
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  pairs?: { left: string; right: string }[];
  explanation?: string;
  skill?: QuestionSkill;
}

interface DemoQuiz {
  title: string;
  description: string;
  topic: string;
  gradeLevel: number;
  coverEmoji: string;
  questions: DemoQuestion[];
}

const mc = (
  questionText: string,
  options: string[],
  correctAnswer: string,
  explanation?: string,
  skill: QuestionSkill = QuestionSkill.VOCABULARY,
): DemoQuestion => ({
  type: QuestionType.MULTIPLE_CHOICE,
  questionText,
  options,
  correctAnswer,
  explanation,
  skill,
});

const match = (
  questionText: string,
  pairs: [string, string][],
): DemoQuestion => ({
  type: QuestionType.MATCHING,
  questionText,
  pairs: pairs.map(([left, right]) => ({ left, right })),
});

export const DEMO_QUIZZES: DemoQuiz[] = [
  {
    title: 'Khám phá sở thú',
    description: 'Học tên các con vật quen thuộc',
    topic: 'Animals',
    gradeLevel: 1,
    coverEmoji: '🦁',
    questions: [
      mc(
        '🐶 What animal is this?',
        ['Dog', 'Cat', 'Duck'],
        'Dog',
        '🐶 là "dog" – con chó.',
      ),
      mc(
        '🐱 What animal is this?',
        ['Fish', 'Cat', 'Bird'],
        'Cat',
        '🐱 là "cat" – con mèo.',
      ),
      mc(
        '🐘 What animal is this?',
        ['Monkey', 'Tiger', 'Elephant'],
        'Elephant',
        '🐘 là "elephant" – con voi.',
      ),
      mc(
        '🐵 What animal is this?',
        ['Monkey', 'Lion', 'Rabbit'],
        'Monkey',
        '🐵 là "monkey" – con khỉ.',
      ),
      match('Match the animals with their names', [
        ['🐶', 'dog'],
        ['🐱', 'cat'],
        ['🐟', 'fish'],
        ['🐦', 'bird'],
      ]),
      match('Match the farm animals', [
        ['🐄', 'cow'],
        ['🐷', 'pig'],
        ['🐔', 'chicken'],
        ['🐴', 'horse'],
      ]),
    ],
  },
  {
    title: 'Thế giới màu sắc',
    description: 'Gọi tên màu sắc bằng tiếng Anh',
    topic: 'Colors',
    gradeLevel: 1,
    coverEmoji: '🌈',
    questions: [
      mc(
        '🍎 What color is the apple?',
        ['Red', 'Blue', 'Green'],
        'Red',
        'Quả táo màu đỏ – "red".',
      ),
      mc(
        '🍌 What color is the banana?',
        ['Purple', 'Yellow', 'Black'],
        'Yellow',
        'Quả chuối màu vàng – "yellow".',
      ),
      mc(
        '🌳 What color are the leaves?',
        ['Green', 'Pink', 'Orange'],
        'Green',
        'Lá cây màu xanh lá – "green".',
      ),
      mc(
        '☁️ What color is the cloud?',
        ['Black', 'White', 'Brown'],
        'White',
        'Đám mây màu trắng – "white".',
      ),
      match('Match the colors', [
        ['🔴', 'red'],
        ['🔵', 'blue'],
        ['🟢', 'green'],
        ['🟡', 'yellow'],
      ]),
    ],
  },
  {
    title: 'Đếm số vui nhộn',
    description: 'Số đếm từ 1 đến 10',
    topic: 'Numbers',
    gradeLevel: 1,
    coverEmoji: '🔢',
    questions: [
      mc(
        'How many apples? 🍎🍎🍎',
        ['Two', 'Three', 'Four'],
        'Three',
        'Có 3 quả táo – "three".',
      ),
      mc('2 + 3 = ?', ['Five', 'Six', 'Four'], 'Five', '2 + 3 = 5 – "five".'),
      mc(
        'What number comes after nine?',
        ['Eight', 'Eleven', 'Ten'],
        'Ten',
        'Sau 9 là 10 – "ten".',
      ),
      match('Match the numbers with the words', [
        ['1', 'one'],
        ['2', 'two'],
        ['5', 'five'],
        ['8', 'eight'],
      ]),
    ],
  },
  {
    title: 'Gia đình của em',
    description: 'Từ vựng về các thành viên trong gia đình',
    topic: 'Family',
    gradeLevel: 2,
    coverEmoji: '👨‍👩‍👧',
    questions: [
      mc(
        "👵 Your mother's mother is your ...",
        ['Grandmother', 'Sister', 'Aunt'],
        'Grandmother',
        'Mẹ của mẹ là bà – "grandmother".',
      ),
      mc(
        '👦 A boy in your family is your ...',
        ['Sister', 'Brother', 'Mother'],
        'Brother',
        'Anh/em trai là "brother".',
      ),
      mc(
        'Choose the correct sentence.',
        ['This is my father.', 'This are my father.', 'These is my father.'],
        'This is my father.',
        'Một người dùng "This is".',
        QuestionSkill.GRAMMAR,
      ),
      match('Match English with Vietnamese', [
        ['father', 'bố'],
        ['mother', 'mẹ'],
        ['brother', 'anh/em trai'],
        ['sister', 'chị/em gái'],
      ]),
    ],
  },
  {
    title: 'Đồ dùng học tập',
    description: 'Những thứ em mang tới trường',
    topic: 'School',
    gradeLevel: 2,
    coverEmoji: '🎒',
    questions: [
      mc(
        '✏️ What is this?',
        ['Pencil', 'Ruler', 'Book'],
        'Pencil',
        '✏️ là "pencil" – bút chì.',
      ),
      mc(
        '📚 What are these?',
        ['Pens', 'Books', 'Bags'],
        'Books',
        '📚 là "books" – những quyển sách.',
      ),
      mc(
        'I ___ a student.',
        ['is', 'are', 'am'],
        'am',
        'Với "I" ta dùng "am".',
        QuestionSkill.GRAMMAR,
      ),
      match('Match the school things', [
        ['✏️', 'pencil'],
        ['📏', 'ruler'],
        ['🎒', 'schoolbag'],
        ['📕', 'book'],
      ]),
    ],
  },
];
