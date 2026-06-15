import {
  IsString, IsArray, ValidateNested, IsInt, Min, Max, IsIn, IsOptional, IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  // GENERAL termín: ticketTypeId. SEATMAP termín: terminSectionId (SECTIONED s quantity / SEATED so seatIds).
  @IsOptional()
  @IsString()
  ticketTypeId?: string;

  @IsOptional()
  @IsString()
  terminSectionId?: string;

  // GENERAL/SECTIONED: počet kusov. SEATED položka quantity neposiela (odvodí sa z seatIds.length).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  quantity?: number;

  // SEATED položka (úloha 22/3b): zoznam konkrétnych sedadiel (Seat.id) v rámci sekcie.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatIds?: string[];
}

export class CreateOrderDto {
  @IsString()
  terminId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsIn([true], { message: 'You must accept the terms and conditions' })
  acceptTerms: boolean;

  // Buyer info – required if not authenticated (but we enforce auth in controller)
  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @IsOptional()
  @IsString()
  buyerName?: string;

  @IsOptional()
  @IsString()
  buyerPhone?: string;

  // Krok 31e1: jazyk kupujúceho (frontend pošle aktuálne locale) → Order.locale pre e-maily.
  @IsOptional()
  @IsIn(['sk', 'en', 'cs'])
  locale?: 'sk' | 'en' | 'cs';
}
