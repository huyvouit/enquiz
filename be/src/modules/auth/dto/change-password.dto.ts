import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;

  /** Minimum length depends on the role: checked in the handler (D20). */
  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới cần ít nhất 6 ký tự' })
  @MaxLength(72) // bcrypt only uses the first 72 bytes
  newPassword: string;
}
