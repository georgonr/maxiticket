import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatMessageDto } from './chat.dto';

/**
 * Guest (neprihlásený) chat s AI agentom. `chatSessionId` je opaque UUID generovaný
 * frontendom – server naň viaže verifiedOrderId v Redise (fáza 2A). Verified stav
 * NIKDY neputuje do tela/histórie – len server-side.
 */
export class GuestChatDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  chatSessionId: string;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsIn(['sk', 'en', 'cs'])
  locale?: 'sk' | 'en' | 'cs';
}
