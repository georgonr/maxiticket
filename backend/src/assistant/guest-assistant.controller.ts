import { Controller, Post, Body, Res, UseGuards, HttpCode, HttpStatus, BadRequestException, HttpException } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { AssistantService, assistantErrorMessage } from './assistant.service';
import { GuestChatDto } from './dto/guest-chat.dto';
import { GuestEscalateDto } from './dto/guest-escalate.dto';
import { sseCorsHeaders } from '../common/cors';

// Potvrdenie eskalácie z endpointu (mimo SSE) – frontend ho zobrazí v chate.
const GUEST_ESC_MSG: Record<string, (n: string) => string> = {
  sk: (n) => `Vytvoril som požiadavku ${n}. Podpora sa vám ozve čo najskôr.`,
  en: (n) => `I've created request ${n}. Support will get back to you as soon as possible.`,
  cs: (n) => `Vytvořil jsem požadavek ${n}. Podpora se vám ozve co nejdříve.`,
};

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

  /**
   * GUEST eskalácia po zadaní e-mailu – vytvorí tiket. Rate limit 3/hod/sessionKey
   * (v service) nad rámec IP throttlu (10/min). Hosťovi vracia LEN číslo tiketu,
   * NIKDY údaje o objednávkach – e-mail nie je overený.
   */
  @Post('escalate')
  @HttpCode(HttpStatus.OK)
  async escalate(@Body() dto: GuestEscalateDto) {
    const locale = dto.locale ?? 'sk';
    const r = await this.svc.escalateGuest({
      chatSessionId: dto.chatSessionId,
      email: dto.email,
      history: dto.messages,
      priority: dto.priority,
      summary: dto.summary,
      locale,
    });
    if (r.status === 'rate_limited') {
      throw new HttpException('Priveľa požiadaviek. Skúste neskôr.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (r.status === 'invalid_email' || r.status === 'need_email') {
      throw new BadRequestException('Neplatný e-mail.');
    }
    if (r.status !== 'created' && r.status !== 'existing') {
      throw new BadRequestException('Eskaláciu sa nepodarilo dokončiť.');
    }
    return { ticketNumber: r.ticketNumber, message: GUEST_ESC_MSG[locale](r.ticketNumber) };
  }
}
