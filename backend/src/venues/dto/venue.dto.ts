import { IsString, IsOptional, IsNumber, IsBoolean, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

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
