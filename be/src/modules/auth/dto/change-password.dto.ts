import { IsString, Matches } from 'class-validator';
import { CLIENT_HASH, OUTDATED_APP } from '../../../common/utils/passwords.js';

/** Both are client hashes; length rules are checked in the browser (D20). */
export class ChangePasswordDto {
  @IsString()
  @Matches(CLIENT_HASH, { message: OUTDATED_APP })
  currentPassword: string;

  @IsString()
  @Matches(CLIENT_HASH, { message: OUTDATED_APP })
  newPassword: string;
}
