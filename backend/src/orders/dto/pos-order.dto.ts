import {
  IsString, IsArray, ValidateNested, IsInt, Min, Max, IsIn, IsOptional, IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PosOrderItemDto {
  @IsString()
  ticketTypeId: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;
}

export class PosOrderDto {
  @IsString()
  terminId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items: PosOrderItemDto[];

  @IsIn(['cash', 'card'])
  paymentMethod: 'cash' | 'card';

  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @IsOptional()
  @IsString()
  buyerName?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
