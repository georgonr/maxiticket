import {
  IsString, IsOptional, IsBoolean, IsInt, IsUrl, IsDateString, MinLength, MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

export class CreateHeroBannerDto {
  @IsString() @MinLength(1) @MaxLength(120) title: string;
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string;
  @IsString() @IsUrl({ require_tld: false }) imageUrl: string;
  @IsOptional() @IsString() @MaxLength(60) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) ctaUrl?: string;
  @IsOptional() @IsInt() @Type(() => Number) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() activeFrom?: string;
  @IsOptional() @IsDateString() activeUntil?: string;
}

export class UpdateHeroBannerDto extends PartialType(CreateHeroBannerDto) {}

export class PromoteShowDto {
  @IsBoolean() isPromoted: boolean;
  @IsOptional() @IsString() sliderImageId?: string | null;
}
