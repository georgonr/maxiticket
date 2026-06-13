import { IsString, MinLength, MaxLength } from 'class-validator';

export class RequestRefundDto {
  @IsString()
  @MinLength(3, { message: 'Uveďte dôvod vrátenia (aspoň 3 znaky).' })
  @MaxLength(1000)
  reason: string;
}
