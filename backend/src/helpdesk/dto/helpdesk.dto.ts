import { IsString, IsOptional, IsEnum, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { HelpdeskStatus, HelpdeskPriority } from '@prisma/client';

export class ReplyDto {
  /** Rovnaký strop ako pri prijatej správe (helpdesk-mail.service MAX_BODY_CHARS). */
  @IsString()
  @MinLength(1, { message: 'Odpoveď nesmie byť prázdna.' })
  @MaxLength(8000)
  body: string;
}

export class PatchTicketDto {
  @IsOptional()
  @IsEnum(HelpdeskStatus)
  status?: HelpdeskStatus;

  @IsOptional()
  @IsEnum(HelpdeskPriority)
  priority?: HelpdeskPriority;

  /** null = odobrať priradenie. Preto ValidateIf, nie samotné IsOptional. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  assignedToId?: string | null;
}
