import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';

export class CreateScannerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** Len pre SUPERADMIN/STAFF – cieľový organizer. ORGANIZER_OWNER ho ignoruje (berie vlastný). */
  @IsOptional()
  @IsString()
  organizerId?: string;
}
