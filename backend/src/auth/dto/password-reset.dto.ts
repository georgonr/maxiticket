import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;

  // Krok 31e2: jazyk požiadavky (request-time) pre lokalizovaný reset e-mail.
  @IsOptional()
  @IsIn(['sk', 'en', 'cs'])
  locale?: 'sk' | 'en' | 'cs';
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
