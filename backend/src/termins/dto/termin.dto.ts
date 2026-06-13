import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsDateString, ValidateIf, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { TerminStatus, TerminMode } from '@prisma/client';

export class CreateTerminDto {
  @IsString() venueId: string;
  @IsDateString() startsAt: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsDateString() doorsOpenAt?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(TerminStatus) status?: TerminStatus;
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @IsNumber() capacity?: number;
  // Úloha 22/3a: režim predaja + väzba na plánik (seatMapId povinný pri SEATMAP)
  @IsOptional() @IsEnum(TerminMode) mode?: TerminMode;
  @IsOptional() @ValidateIf((o) => o.seatMapId !== null) @IsString() seatMapId?: string | null;
}

export class UpdateTerminDto extends PartialType(CreateTerminDto) {}

// Úloha 22/3a: nastavenie ceny sekcie pre termín (per TerminSection)
export class UpdateTerminSectionDto {
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsString() currency?: string;
}
