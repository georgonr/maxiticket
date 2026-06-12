import { IsBoolean } from 'class-validator';

export class UpdateScannerDto {
  @IsBoolean()
  isActive: boolean;
}
