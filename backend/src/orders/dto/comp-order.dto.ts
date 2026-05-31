import { IsEmail, IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class CompOrderDto {
  @IsString() showId: string;
  @IsString() terminId: string;
  @IsString() ticketTypeId: string;
  @IsInt() @Min(1) @Max(50) quantity: number;
  @IsEmail() buyerEmail: string;
  @IsString() @MinLength(1) buyerName: string;
}
