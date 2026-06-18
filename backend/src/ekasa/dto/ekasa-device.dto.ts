import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEkasaDeviceDto {
  @IsString() organizerId: string;
  @IsString() @MinLength(1) label: string;
  @IsString() @MinLength(1) cashRegisterCode: string;
  @IsString() @MinLength(1) exposeUrl: string;
  @IsString() @MinLength(1) accessToken: string;
  @IsOptional() @IsIn(['pos', 'pdf', 'email']) printMode?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateEkasaDeviceDto {
  @IsOptional() @IsString() @MinLength(1) label?: string;
  @IsOptional() @IsString() @MinLength(1) cashRegisterCode?: string;
  @IsOptional() @IsString() @MinLength(1) exposeUrl?: string;
  // prázdny / vynechaný = token sa nemení
  @IsOptional() @IsString() accessToken?: string;
  @IsOptional() @IsIn(['pos', 'pdf', 'email']) printMode?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
