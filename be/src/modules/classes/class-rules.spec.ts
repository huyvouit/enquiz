import {
  CLASS_CODE_ALPHABET,
  CLASS_CODE_LENGTH,
  generateClassCode,
  normalizeClassCode,
  pickUsername,
  stripVietnamese,
  usernameStem,
} from './class-rules.js';

describe('class rules', () => {
  it('generates codes without look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateClassCode();
      expect(code).toHaveLength(CLASS_CODE_LENGTH);
      for (const ch of code) expect(CLASS_CODE_ALPHABET).toContain(ch);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('normalizes typed codes', () => {
    expect(normalizeClassCode(' ab3-x7 k ')).toBe('AB3X7K');
  });

  it('strips Vietnamese diacritics', () => {
    expect(stripVietnamese('Nguyễn Văn Đức')).toBe('nguyen van duc');
    expect(stripVietnamese('  Trần   Thị   Ánh  ')).toBe('tran thi anh');
  });

  it('builds username stems from given names', () => {
    expect(usernameStem('Nguyễn Minh Anh')).toBe('minhanh');
    expect(usernameStem('Lê Na')).toBe('lena');
    expect(usernameStem('Phạm An')).toBe('phaman');
    expect(usernameStem('Ý')).toBe('yhs');
    expect(usernameStem('Bình')).toBe('binh');
    expect(usernameStem('!!')).toBe('hocsinh');
    expect(
      usernameStem('Phạm Thị Hồng Nhung Khánh Linh Ngọc').length,
    ).toBeLessThanOrEqual(20);
  });

  it('picks the first free username', () => {
    expect(pickUsername('minhanh', new Set())).toBe('minhanh');
    expect(pickUsername('minhanh', new Set(['minhanh', 'minhanh2']))).toBe(
      'minhanh3',
    );
  });
});
