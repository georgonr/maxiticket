import { Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type VerifyStatus = 'VERIFIED' | 'FAILED' | 'LOCKED' | 'NEEDS_ESCALATION' | 'AMBIGUOUS';

const VERIFIED_TTL_SEC = 1800; // 30 min platnosť overenej chat-session
const FAIL_TTL_SEC = 900; // 15 min okno pre počítadlo neúspechov
const MAX_FAILS = 5;

const verifiedKey = (chatSessionId: string) => `assistant:verified:${chatSessionId}`;
const failKey = (identifier: string) => `assistant:verifyfail:${identifier.trim().toLowerCase()}`;

/**
 * Server-side overenie totožnosti guest zákazníka pre AI agenta (fáza 2A).
 * Pravidlo: last4 karty VŽDY + jeden identifikátor {email | orderNumber | paymentRef}.
 * LLM NEROZHODUJE o pass/fail – rozhoduje táto služba; verifiedOrderId žije LEN v Redise.
 */
@Injectable()
export class VerifyService {
  private readonly logger = new Logger(VerifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Vráti verifiedOrderId pre danú chat-session (alebo null ak neoverené/expirované). */
  async getVerifiedOrderId(chatSessionId: string): Promise<string | null> {
    if (!chatSessionId) return null;
    return this.redis.get(verifiedKey(chatSessionId));
  }

  /** Constant-time porovnanie presne 4-znakových last4 (guard na dĺžku). */
  private last4Equals(a: string, b: string): boolean {
    if (!/^\d{4}$/.test(a) || !/^\d{4}$/.test(b)) return false;
    try {
      return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
    } catch {
      return false;
    }
  }

  async verify(
    last4: string,
    identifier: string,
    chatSessionId: string,
  ): Promise<{ status: VerifyStatus }> {
    const id = (identifier ?? '').trim();
    const code = (last4 ?? '').trim();
    if (!id || !chatSessionId) return { status: 'FAILED' };

    // (a) Lockout check – počítadlo neúspechov per identifikátor.
    const fails = Number((await this.redis.get(failKey(id))) ?? '0');
    if (fails >= MAX_FAILS) return { status: 'LOCKED' };

    // (b) Kandidáti podľa ktoréhokoľvek identifikátora (jeden dopyt, bez heuristiky typu).
    const candidates = await this.prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { equals: id, mode: 'insensitive' } },
          { paymentRef: { equals: id } },
          { buyerEmail: { equals: id, mode: 'insensitive' } },
        ],
      },
      select: { id: true, cardLast4: true },
    });

    if (candidates.length === 0) {
      await this.registerFail(id);
      return { status: 'FAILED' }; // neprezradíme, že objednávka neexistuje
    }

    const cardable = candidates.filter((c) => c.cardLast4 && /^\d{4}$/.test(c.cardLast4));
    // (c) Žiadny kandidát nemá kartu (mock/POS/comp/staré) → kartou sa nedá overiť.
    if (cardable.length === 0) return { status: 'NEEDS_ESCALATION' };

    // (d) Constant-time compare voči VŠETKÝM cardable kandidátom (bez skratky pri prvej zhode).
    const matches = cardable.filter((c) => this.last4Equals(code, c.cardLast4 as string));

    if (matches.length === 1) {
      await this.redis.set(verifiedKey(chatSessionId), matches[0].id, VERIFIED_TTL_SEC);
      await this.redis.del(failKey(id));
      return { status: 'VERIFIED' };
    }
    if (matches.length > 1) {
      // Viac objednávok s tým istým emailom+last4 → treba spresniť číslom objednávky.
      return { status: 'AMBIGUOUS' };
    }

    // (e) 0 zhôd: ak existuje aspoň jeden cardable kandidát, ide o zlý last4 → FAIL + počítadlo.
    await this.registerFail(id);
    return { status: 'FAILED' };
  }

  private async registerFail(identifier: string): Promise<void> {
    const n = await this.redis.incr(failKey(identifier));
    if (n === 1) await this.redis.expire(failKey(identifier), FAIL_TTL_SEC);
  }
}
