import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional() @IsString() organizerId?: string;
}
