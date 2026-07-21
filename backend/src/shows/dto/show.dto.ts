import { IsString, IsOptional, IsEnum, MinLength, IsObject, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { EventStatus } from '@prisma/client';
import { SHOW_CATEGORIES } from '../../common/show-categories';

export class CreateShowDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) slug: string;
  @IsOptional() @IsString() description?: string;
  // Kategória musí byť z pevného zoznamu – bez toho sa dropdown obíde cez API
  // a vrátia sa voľné texty ("popovy koncert"). Prázdny string z formulára
  // mapujeme na undefined, aby "nevybraté" ostalo validné (Show.category je String?).
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsIn(SHOW_CATEGORIES)
  category?: string;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  @IsOptional() @IsObject() ticketTemplate?: Record<string, unknown>;
}

export class UpdateShowDto extends PartialType(CreateShowDto) {}

export class UpdateShowStatusDto {
  @IsEnum(EventStatus) status: EventStatus;
}
