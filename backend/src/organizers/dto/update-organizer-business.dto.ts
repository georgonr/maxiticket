import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDecimal,
  Matches,
  Length,
  ValidateIf,
} from 'class-validator';

export class UpdateOrganizerBusinessDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  @Length(6, 12)
  ico?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}\d{8,12}$/, { message: 'icDph must be in format e.g. SK1234567890' })
  icDph?: string;

  @IsOptional()
  @IsBoolean()
  vatPayer?: boolean;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  vatRate?: string;

  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressCity?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.addressCountry || o.addressCountry === 'SK')
  @Matches(/^\d{5}$/, { message: 'addressZip must be 5 digits for SK' })
  addressZip?: string;

  @IsOptional()
  @IsString()
  addressCountry?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;
}
