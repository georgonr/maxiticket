import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Per-organizátor fakturačná konfigurácia – LEN super-admin/staff. */
export class UpdateOrganizerBillingDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPercent?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatPercent?: number;
  @IsOptional() @IsBoolean() feesIncluded?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) customerFeePercent?: number;
}
