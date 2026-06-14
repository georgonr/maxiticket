import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// Úloha 24: nastavenie množiny organizátorov so sprístupnením miesta.
export class SetVenueAccessDto {
  @IsArray()
  @IsString({ each: true })
  organizerIds: string[];
}

export class CreateVenueDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsNumber() capacity?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateVenueDto extends PartialType(CreateVenueDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
