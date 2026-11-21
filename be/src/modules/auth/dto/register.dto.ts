import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum.js';
import { CLIENT_HASH, OUTDATED_APP } from '../../../common/utils/passwords.js';

/** Admin accounts cannot self-register; they are created by seed/ops. */
export const REGISTERABLE_ROLES = [Role.STUDENT, Role.TEACHER] as const;

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_.]+$/, {
    message: 'username chỉ gồm chữ, số, dấu _ và dấu .',
  })
  username: string;

  /** Client hash; the 6-character minimum is checked in the browser. */
  @IsString()
  @Matches(CLIENT_HASH, { message: OUTDATED_APP })
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  fullName: string;

  @IsIn(REGISTERABLE_ROLES)
  role: Role.STUDENT | Role.TEACHER;

  /** Required for students (grade 1-5), ignored for teachers. */
  @ValidateIf((o: RegisterDto) => o.role === Role.STUDENT)
  @IsInt()
  @Min(1)
  @Max(5)
  gradeLevel?: number;
}
