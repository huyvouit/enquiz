import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { CLIENT_HASH, OUTDATED_APP } from '../../../common/utils/passwords.js';

export class LoginDto {
  @IsString()
  @MinLength(1)
  username: string;

  /** Client hash of the password, never the password itself. */
  @IsString()
  @Matches(CLIENT_HASH, { message: OUTDATED_APP })
  password: string;

  /** "Ghi nhớ đăng nhập trên máy này" (plan D22). Off by default. */
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
