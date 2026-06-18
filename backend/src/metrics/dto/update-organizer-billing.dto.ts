import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { BillingMode } from '@prisma/client';

/** Per-organizátor fakturačná konfigurácia – LEN super-admin/staff. */
export class UpdateOrganizerBillingDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPercent?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatPercent?: number;
  @IsOptional() @IsBoolean() feesIncluded?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) customerFeePercent?: number;

  // Fakturačný systém (krok 13a)
  @IsOptional() @IsEnum(BillingMode) billingMode?: BillingMode;
  // null = platformová konštanta (40); inak 0..10000 cents
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(10000) refundFeePerTicketCents?: number | null;

  // eKasa: DPH sadzba lístka na eKasa doklade (zákaznícka DPH; 0 ak neplatca / znížená sadzba podľa účtovníka).
  @IsOptional() @IsInt() @Min(0) @Max(100) ticketVatPercent?: number;
}
