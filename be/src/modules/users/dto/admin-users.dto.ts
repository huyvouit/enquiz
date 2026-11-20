import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountStatus } from '../../../common/enums/account-status.enum.js';
import { Role } from '../../../common/enums/role.enum.js';
import { PaginationQueryDto } from '../../../common/utils/pagination.js';

export class ListUsersDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  /** Matches username or full name. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}

export class SetUserStatusDto {
  @IsIn([AccountStatus.ACTIVE, AccountStatus.DISABLED])
  status: AccountStatus.ACTIVE | AccountStatus.DISABLED;
}
