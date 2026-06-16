import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  IsIn,
  Min,
  Max,
  IsDateString,
  IsEmail,
} from 'class-validator';
import { CouponType, CouponScope } from '@prisma/client';

export class BulkGenerateCouponsDto {
  @IsInt()
  @Min(1)
  @Max(100)
  count: number;

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
  maxUses?: number; // per-coupon limit

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  // Default = email tvorcu (doplnené v service ak chýba)
  @IsOptional()
  @IsEmail()
  sendToEmail?: string;

  // Krok 31e2: jazyk staff aktéra pre lokalizovaný coupon-batch e-mail (chrome).
  @IsOptional()
  @IsIn(['sk', 'en', 'cs'])
  locale?: 'sk' | 'en' | 'cs';
}
