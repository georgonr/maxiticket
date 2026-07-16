import { IsOptional, IsBoolean, IsString, MaxLength } from 'class-validator';

export class UpdateTelegramConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  chatId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** true = notifikovať len eskalované konverzácie (filter proti spamu). */
  @IsOptional()
  @IsBoolean()
  escalationOnly?: boolean;
}
