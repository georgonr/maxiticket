import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ContactDto {
  @IsString() @IsNotEmpty() @MaxLength(100) meno: string;
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() @MaxLength(200) predmet: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) sprava: string;

  // Krok 31e2: jazyk odosielateľa (public formulár) pre lokalizovaný kontakt e-mail.
  @IsOptional() @IsIn(['sk', 'en', 'cs']) locale?: 'sk' | 'en' | 'cs';
}
