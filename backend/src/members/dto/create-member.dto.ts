import { IsEmail, IsIn, IsString, IsOptional } from 'class-validator';

export class CreateMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** Len SUPERADMIN/STAFF – cieľový organizer. */
  @IsOptional()
  @IsString()
  organizerId?: string;

  // Krok 31e2: jazyk pozývajúceho (staff) pre lokalizovaný invite e-mail.
  @IsOptional()
  @IsIn(['sk', 'en', 'cs'])
  locale?: 'sk' | 'en' | 'cs';
}
