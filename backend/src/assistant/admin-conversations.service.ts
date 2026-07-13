import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 30;

/** SUPERADMIN prehliadanie AI konverzácií (read-only) – krok AI-KONV-4. */
@Injectable()
export class AdminConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: { status?: string; escalated?: string; channel?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: any = {};
    if (q.status === 'OPEN' || q.status === 'CLOSED') where.status = q.status;
    if (q.channel === 'GUEST' || q.channel === 'CUSTOMER') where.channel = q.channel;
    if (q.escalated === 'true') where.escalated = true;

    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { _count: { select: { messages: true } } },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const emailMap = await this.emailsFor(rows);
    return {
      items: rows.map((c) => ({
        id: c.id,
        channel: c.channel,
        locale: c.locale,
        status: c.status,
        escalated: c.escalated,
        summary: c.summary,
        messageCount: c._count.messages,
        email: c.userId ? emailMap.get(c.userId) ?? null : null,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
        closedAt: c.closedAt,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async detail(id: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, createdAt: true } },
      },
    });
    if (!c) throw new NotFoundException('Konverzácia neexistuje');
    const email = c.userId
      ? (await this.prisma.user.findUnique({ where: { id: c.userId }, select: { email: true } }))?.email ?? null
      : null;
    return {
      id: c.id,
      channel: c.channel,
      sessionKey: c.sessionKey,
      email,
      locale: c.locale,
      status: c.status,
      escalated: c.escalated,
      summary: c.summary,
      createdAt: c.createdAt,
      lastMessageAt: c.lastMessageAt,
      closedAt: c.closedAt,
      messages: c.messages,
    };
  }

  private async emailsFor(rows: { userId: string | null }[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])];
    const map = new Map<string, string>();
    if (ids.length) {
      const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
      for (const u of users) map.set(u.id, u.email);
    }
    return map;
  }
}
