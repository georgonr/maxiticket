import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateScanDto {
  @IsString()
  @IsNotEmpty()
  qrToken: string;

  @IsString()
  @IsNotEmpty()
  terminId: string;
}
