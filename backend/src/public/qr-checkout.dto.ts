import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Telo POST /v1/public/qr-checkout – QR rýchly nákup (scan-to-buy). */
export class QrCheckoutDto {
  @IsString() ticketTypeId: string;

  @IsInt() @Min(1) @Max(10) quantity: number;

  @IsEmail() email: string;

  @IsOptional() @IsIn(['sk', 'en', 'cs']) locale?: string;
}
