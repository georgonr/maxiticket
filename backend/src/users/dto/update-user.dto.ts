import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  // isActive sa mení výhradne cez guarded endpoint /users/:id/active (canManageTarget strop).
}

export class SetActiveDto {
  @IsBoolean() isActive: boolean;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional() @IsString() organizerId?: string;
}
