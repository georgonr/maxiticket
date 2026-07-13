import { IsOptional, IsBoolean, IsString, MaxLength } from 'class-validator';

export class UpdateTelegramConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  chatId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
