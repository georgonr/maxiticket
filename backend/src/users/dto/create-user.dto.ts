import { IsEmail, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;

  /** Povinné len pre organizátorské (tenant) role – ORGANIZER_OWNER/_MEMBER/SCANNER. */
  @IsOptional() @IsString() organizerId?: string;

  /** Jazyk pozvánkového e-mailu. */
  @IsOptional() @IsIn(['sk', 'en', 'cs']) locale?: 'sk' | 'en' | 'cs';
}
