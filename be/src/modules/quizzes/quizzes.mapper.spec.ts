import { Types } from 'mongoose';
import { QuestionType } from '../questions/question-types.js';
import { toPlayQuestion } from './quizzes.mapper.js';

const listening = {
  _id: new Types.ObjectId(),
  type: QuestionType.MULTIPLE_CHOICE,
  questionText: 'Nghe và chọn',
  options: ['🦆', '🐔'],
  correctAnswer: '🦆',
  audioText: 'a duck',
};

describe('toPlayQuestion: listening (plan D16)', () => {
  it('sends the audio URL, never the text', () => {
    const q = toPlayQuestion({ ...listening, audioUrl: '/a/1.mp3' });
    expect(q.audioUrl).toBe('/a/1.mp3');
    expect(q.audioPending).toBeUndefined();
    expect(JSON.stringify(q)).not.toContain('a duck');
    expect(JSON.stringify(q)).not.toContain('correctAnswer');
  });

  it('flags a listening question whose audio is not made yet', () => {
    const q = toPlayQuestion(listening);
    expect(q.audioPending).toBe(true);
    expect(q.audioUrl).toBeUndefined();
    expect(JSON.stringify(q)).not.toContain('a duck');
  });

  it('leaves other questions alone', () => {
    const q = toPlayQuestion({ ...listening, audioText: undefined });
    expect(q.audioPending).toBeUndefined();
  });
});
