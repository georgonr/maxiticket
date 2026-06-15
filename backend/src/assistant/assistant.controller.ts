import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import { AssistantService, assistantErrorMessage } from './assistant.service';
import { ChatDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

// Krok 28: chat asistent pre PRIHLÁSENÉHO zákazníka. userId zo session, nikdy z tela/LLM.
@Controller('assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class AssistantController {
  constructor(private readonly svc: AssistantService) {}

  @Post('chat')
  async chat(@Body() dto: ChatDto, @CurrentUser() user: JwtPayload, @Res() reply: FastifyReply) {
    // SSE – streamujeme priamo do raw odpovede (Fastify nemá riadiť telo).
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const emit = (ev: unknown) => raw.write(`data: ${JSON.stringify(ev)}\n\n`);
    try {
      await this.svc.runChat(user.sub, dto.messages, emit, dto.locale ?? 'sk');
    } catch {
      emit({ type: 'error', message: assistantErrorMessage(dto.locale ?? 'sk') });
    } finally {
      raw.end();
    }
  }
}
