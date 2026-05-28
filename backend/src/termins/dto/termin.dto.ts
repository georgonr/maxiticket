import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsDateString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { TerminStatus } from '@prisma/client';

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
}

export class UpdateTerminDto extends PartialType(CreateTerminDto) {}
