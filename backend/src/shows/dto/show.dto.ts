import { IsString, IsOptional, IsEnum, MinLength, IsObject } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { EventStatus } from '@prisma/client';

export class CreateShowDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) slug: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  @IsOptional() @IsObject() ticketTemplate?: Record<string, unknown>;
}

export class UpdateShowDto extends PartialType(CreateShowDto) {}

export class UpdateShowStatusDto {
  @IsEnum(EventStatus) status: EventStatus;
}
