import {
  IsIn, IsOptional, IsString, MaxLength, IsNumber, Min,
} from 'class-validator';

export class ReviewRefundDto {
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;

  /** Voliteľná suma na vrátenie (default = celá objednávka). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundAmount?: number;
}
