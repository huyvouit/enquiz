import { AccountStatus } from '../../common/enums/account-status.enum.js';
import {
  AccountStatusService,
  passwordChangeStamp,
  toEpochSeconds,
} from './account-status.service.js';

const state = (passwordChangedAt: number | null) => ({
  status: AccountStatus.ACTIVE,
  passwordChangedAt,
});

describe('tokenStillValid (plan D20)', () => {
  it('accepts any token while the password was never changed', () => {
    expect(AccountStatusService.tokenStillValid(state(null), 1)).toBe(true);
  });

  it('refuses a token issued before the change', () => {
    expect(AccountStatusService.tokenStillValid(state(1000), 999)).toBe(false);
  });

  it('accepts the token issued in the same second (the new one)', () => {
    expect(AccountStatusService.tokenStillValid(state(1000), 1000)).toBe(true);
    expect(AccountStatusService.tokenStillValid(state(1000), 1001)).toBe(true);
  });

  it('treats a token without iat as valid (jsonwebtoken always sets one)', () => {
    expect(AccountStatusService.tokenStillValid(state(1000), undefined)).toBe(
      true,
    );
  });

  it('stamps whole seconds, like a JWT iat', () => {
    const stamp = passwordChangeStamp();
    expect(stamp.getTime() % 1000).toBe(0);
    expect(toEpochSeconds(stamp)).toBe(Math.floor(stamp.getTime() / 1000));
  });
});
