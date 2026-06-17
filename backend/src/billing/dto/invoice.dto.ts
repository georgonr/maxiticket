import { IsInt, IsNumber, IsOptional, IsString, Min, Max, MinLength } from 'class-validator';

/** Telo POST .../organizers/:id/invoices – scope (termín alebo obdobie). */
export class CreateInvoiceDto {
  @IsOptional() @IsString() occurrenceId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

export class AddLineItemDto {
  @IsString() @MinLength(1) description: string;
  @IsInt() @Min(1) @Max(100000) quantity: number;
  @IsInt() @Min(-100000000) @Max(100000000) unitPriceCents: number;
  @IsNumber() @Min(0) @Max(100) vatPercent: number;
}

export class UpdateLineItemDto {
  @IsOptional() @IsString() @MinLength(1) description?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) quantity?: number;
  @IsOptional() @IsInt() @Min(-100000000) @Max(100000000) unitPriceCents?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatPercent?: number;
}

export class UpdateInvoiceDto {
  @IsOptional() @IsString() taxDate?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() note?: string;
}
