import { IsString, IsNumber, IsOptional, IsBoolean, IsDateString, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

export class CreateTicketTypeDto {
  @IsString() name: string;
  @IsNumber() @Min(0) @Type(() => Number) price: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number) totalQuantity?: number;
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number) maxPerOrder?: number;
  @IsOptional() @IsDateString() saleStartsAt?: string;
  @IsOptional() @IsDateString() saleEndsAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsNumber() @Type(() => Number) sortOrder?: number;
}

export class UpdateTicketTypeDto extends PartialType(CreateTicketTypeDto) {}
