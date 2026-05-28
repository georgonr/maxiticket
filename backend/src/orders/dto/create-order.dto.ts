import {
  IsString, IsArray, ValidateNested, IsInt, Min, Max, IsIn, IsOptional, IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString()
  ticketTypeId: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;
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
}
