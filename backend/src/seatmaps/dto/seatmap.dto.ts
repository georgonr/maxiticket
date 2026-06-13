import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  MinLength,
  Min,
  Max,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { SectionMode } from '@prisma/client';

// ── SeatMap ────────────────────────────────────────────────
export class CreateSeatMapDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateSeatMapDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Section: generátor radov/sedadiel (len pre SEATED) ─────
export enum RowLabelStyle {
  ALPHA = 'ALPHA',
  NUMERIC = 'NUMERIC',
}

export class GenerateSeatsDto {
  @IsInt() @Min(1) @Max(200) rowCount: number;
  @IsInt() @Min(1) @Max(500) seatsPerRow: number;
  @IsEnum(RowLabelStyle) rowLabelStyle: RowLabelStyle;
  @IsOptional() @IsInt() @Min(0) seatStartNumber?: number;
}

export class CreateSectionDto {
  @IsString() @MinLength(1) name: string;
  @IsEnum(SectionMode) mode: SectionMode;

  // SECTIONED → kapacita (číslo). Pre SEATED sa ignoruje (odvodí sa z počtu sedadiel).
  @IsOptional() @IsInt() @Min(0) capacity?: number;

  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color musí byť hex, napr. #1a2b3c' }) color?: string;

  // SEATED → voliteľný generátor radov/sedadiel
  @IsOptional() @ValidateNested() @Type(() => GenerateSeatsDto) generate?: GenerateSeatsDto;
}

// mode je immutable (zmena režimu = zmazať + vytvoriť sekciu)
export class UpdateSectionDto extends PartialType(
  OmitType(CreateSectionDto, ['mode', 'generate'] as const),
) {}
