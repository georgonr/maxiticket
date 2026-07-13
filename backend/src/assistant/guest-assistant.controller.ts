import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { AssistantService, assistantErrorMessage } from './assistant.service';
import { GuestChatDto } from './dto/guest-chat.dto';
import { sseCorsHeaders } from '../common/cors';

/**
 * Guest (neprihlásený) AI agent – fáza 2A. BEZ JwtAuthGuard; scoping cez chatSessionId
 * a server-side overenie (VerifyService/Redis). IP-based throttle proti brute-force.
 * Existujúci prihlásený /v1/assistant/chat sa NEMENÍ.
 */
@Controller('assistant/guest')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class GuestAssistantController {
  constructor(private readonly svc: AssistantService) {}

  @Post('chat')
  async chat(@Body() dto: GuestChatDto, @Res() reply: FastifyReply) {
    // hijack() obchádza @fastify/cors hook → CORS hlavičky pre SSE doplníme ručne.
    const origin = reply.request.headers.origin as string | undefined;
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...sseCorsHeaders(origin),
    });

    const emit = (ev: unknown) => raw.write(`data: ${JSON.stringify(ev)}\n\n`);
    try {
      await this.svc.runGuestChat(dto.chatSessionId, dto.messages, emit, dto.locale ?? 'sk');
    } catch {
      emit({ type: 'error', message: assistantErrorMessage(dto.locale ?? 'sk') });
    } finally {
      raw.end();
    }
  }
}
