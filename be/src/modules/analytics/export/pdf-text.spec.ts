import { classLabel, stripEmoji, stripEmojiText } from './pdf-text.js';

describe('pdf text helpers', () => {
  it('drops emoji and dangling arrows', () => {
    expect(stripEmojiText('🐶 What animal is this?')).toBe(
      'What animal is this?',
    );
    expect(stripEmojiText('🐶 → dog, 🐱 → cat')).toBe('dog, cat');
    expect(stripEmojiText('👩‍⚕️ She is a doctor')).toBe('She is a doctor');
    expect(stripEmojiText('Bảng điểm – Lớp 1A')).toBe('Bảng điểm – Lớp 1A');
  });

  it('walks a document but keeps functions', () => {
    const footer = () => 'x';
    const doc = stripEmoji({
      content: [{ text: '🦁 Sở thú' }, ['🍎 a']],
      footer,
    });
    expect(doc).toEqual({ content: [{ text: 'Sở thú' }, ['a']], footer });
  });

  it('does not repeat "Lớp"', () => {
    expect(classLabel('Lớp 1A')).toBe('Lớp 1A');
    expect(classLabel('1A')).toBe('Lớp 1A');
  });
});
