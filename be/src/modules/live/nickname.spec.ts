import { checkNickname, isRude, uniqueNickname } from './nickname.js';
import { SlidingWindowLimiter } from '../../common/rate-limit/sliding-window-limiter.js';

describe('guest nicknames (L11)', () => {
  it('accepts Vietnamese names, digits and single spaces', () => {
    expect(checkNickname('  Mèo   Con ')).toEqual({
      ok: true,
      nickname: 'Mèo Con',
    });
    expect(checkNickname('Bé Na 2')).toMatchObject({ ok: true });
    expect(checkNickname('Nguyễn Thị Ánh')).toMatchObject({ ok: true });
  });

  it('refuses bad lengths and characters', () => {
    expect(checkNickname('A')).toEqual({ ok: false, reason: 'length' });
    expect(checkNickname('x'.repeat(17))).toEqual({
      ok: false,
      reason: 'length',
    });
    expect(checkNickname(42)).toEqual({ ok: false, reason: 'length' });
    expect(checkNickname('<b>An</b>')).toEqual({
      ok: false,
      reason: 'characters',
    });
    expect(checkNickname('An 😀')).toEqual({ ok: false, reason: 'characters' });
  });

  it('catches swear words, with or without accents and tricks', () => {
    for (const rude of [
      'Đụ má',
      'du ma',
      'đmm',
      'Dmm ban',
      'DCM',
      'vcl',
      'sh1t',
      'f u c k',
      'Fuuuck',
      'ditme',
      'Buồi',
      'Lồn',
      'Con Cặc',
      'con cac',
      'cai lon',
    ]) {
      expect(isRude(rude), rude).toBe(true);
    }
    expect(checkNickname('vcl')).toEqual({ ok: false, reason: 'rude' });
  });

  it('does not block real names that look alike without accents', () => {
    for (const name of [
      'Long',
      'Vũ Long',
      'Các bạn',
      'Cúc',
      'Phúc',
      'Bùi An',
      'Dũng',
      'Đức',
      'Đạt',
      'Vy Linh',
      'Dương',
      'Cường',
      'Essex',
    ]) {
      expect(isRude(name), name).toBe(false);
    }
  });

  it('numbers a taken nickname, ignoring case', () => {
    expect(uniqueNickname('Mèo', ['An'])).toBe('Mèo');
    expect(uniqueNickname('Mèo', ['mèo'])).toBe('Mèo 2');
    expect(uniqueNickname('Mèo', ['Mèo', 'Mèo 2'])).toBe('Mèo 3');
    expect(uniqueNickname('Siêu nhân xanh lá', ['Siêu nhân xanh lá'])).toBe(
      'Siêu nhân xanh 2',
    );
  });
});

describe('SlidingWindowLimiter (L4)', () => {
  it('allows `limit` hits per window, then refuses until they age out', () => {
    const limiter = new SlidingWindowLimiter(2, 1_000);
    expect(limiter.hit('k', 0)).toBe(true);
    expect(limiter.hit('k', 100)).toBe(true);
    expect(limiter.allowed('k', 200)).toBe(false);
    expect(limiter.hit('k', 200)).toBe(false);
    expect(limiter.allowed('other', 200)).toBe(true);
    expect(limiter.allowed('k', 1_150)).toBe(true);
    limiter.prune(5_000);
    expect(limiter.allowed('k', 5_000)).toBe(true);
  });
});
