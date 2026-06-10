import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  Length,
} from 'class-validator';
import { CouponType, CouponScope } from '@prisma/client';

export class CreateCouponDto {
  @IsOptional()
  @IsString()
  @Length(4, 32)
  code?: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsNumber()
  value: number;

  @IsEnum(CouponScope)
  scope: CouponScope;

  @IsOptional()
  @IsString()
  organizerId?: string;

  @IsOptional()
  @IsString()
  showId?: string;

  @IsOptional()
  @IsString()
  ticketTypeId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;
}
