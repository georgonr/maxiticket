import { IsString, MinLength } from 'class-validator';

// Úloha 23: zmena hesla existujúceho scanner účtu (mení sa LEN passwordHash).
export class ChangeScannerPasswordDto {
  @IsString()
  @MinLength(8)
  password: string;
}
