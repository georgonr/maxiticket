import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class RedeemCouponDto {
  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsNumber()
  @Min(0)
  discountAmount: number;
}
