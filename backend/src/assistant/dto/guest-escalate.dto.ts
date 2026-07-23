import { IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatMessageDto } from './chat.dto';

/**
 * GUEST eskalácia po zadaní e-mailu (krok 38). Toto je „nový endpoint" z toku:
 * agent najprv vypýta e-mail, tiket vznikne až týmto volaním. E-mail validujeme
 * a orezávame; rate limit (3/hod/sessionKey) rieši HelpdeskEscalationService.
 */
export class GuestEscalateDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  chatSessionId: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH';

  @IsOptional()
  @IsIn(['sk', 'en', 'cs'])
  locale?: 'sk' | 'en' | 'cs';
}
