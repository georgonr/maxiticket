import { IsString, IsOptional, IsDecimal } from 'class-validator';

export class UpdatePlatformInfoDto {
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  ico?: string;

  @IsOptional()
  @IsString()
  dic?: string;

  @IsOptional()
  @IsString()
  icDph?: string;

  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressCity?: string;

  @IsOptional()
  @IsString()
  addressZip?: string;

  @IsOptional()
  @IsString()
  addressCountry?: string;

  /** Zápis v obchodnom registri – súd, oddiel, vložka. */
  @IsOptional()
  @IsString()
  registrationNote?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  defaultVatRateSk?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  defaultVatRateCz?: string;
}
