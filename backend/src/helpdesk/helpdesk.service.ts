import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HelpdeskStatus, HelpdeskPriority, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { helpdeskSubject } from './helpdesk-number.service';

const PAGE_SIZE = 30;

/** Výsledok odpovede – uloženie a odoslanie sú dve NEZÁVISLÉ veci, viď reply(). */
export interface ReplyResult {
  messageSaved: boolean;
  emailed: boolean;
  error?: string;
  messageId?: string;
}

@Injectable()
export class HelpdeskService {
  private readonly logger = new Logger(HelpdeskService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async list(q: { status?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.HelpdeskTicketWhereInput = {};
    if (q.status && q.status in HelpdeskStatus) {
      where.status = q.status as HelpdeskStatus;
    }

    const [rows, total] = await Promise.all([
      this.prisma.helpdeskTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          _count: { select: { messages: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      }),
      this.prisma.helpdeskTicket.count({ where }),
    ]);

    return {
      items: rows.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        customerEmail: t.customerEmail,
        status: t.status,
        priority: t.priority,
        source: t.source,
        messageCount: t._count.messages,
        lastMessageAt: t.messages[0]?.createdAt ?? null,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async detail(id: string) {
    const t = await this.prisma.helpdeskTicket.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!t) throw new NotFoundException('Tiket neexistuje.');
    return t;
  }

  async patch(
    id: string,
    dto: { status?: HelpdeskStatus; priority?: HelpdeskPriority; assignedToId?: string | null },
  ) {
    await this.assertExists(id);
    return this.prisma.helpdeskTicket.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && {
          status: dto.status,
          // closedAt drží čas skutočného uzavretia; pri znovuotvorení sa musí zmazať.
          closedAt: dto.status === HelpdeskStatus.CLOSED ? new Date() : null,
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
      },
    });
  }

  /**
   * Odpoveď operátora.
   *
   * ULOŽENIE A ODOSLANIE SÚ ODDELENÉ A V TOMTO PORADÍ. Text, ktorý admin
   * napísal, sa uloží VŽDY – aj keď SMTP zlyhá. Opačné poradie (najprv poslať,
   * uložiť až po úspechu) by pri výpadku pošty zahodilo napísanú odpoveď a
   * zákazníkovi by pritom mohol mail už odísť.
   *
   * Volajúci dostane { messageSaved, emailed, error }, aby UI vedelo povedať
   * „uložené, ale e-mail neodišiel" namiesto tichého úspechu alebo tichej straty.
   */
  async reply(id: string, body: string, authorId: string): Promise<ReplyResult> {
    const ticket = await this.prisma.helpdeskTicket.findUnique({
      where: { id },
      include: {
        messages: {
          where: { emailMessageId: { not: null } },
          orderBy: { createdAt: 'asc' },
          select: { sender: true, emailMessageId: true },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Tiket neexistuje.');

    // In-Reply-To má ukazovať na POSLEDNÚ správu zákazníka – na tú reálne
    // odpovedáme. References je celá doterajšia reťaz, aby klient poskladal vlákno.
    const lastCustomer = [...ticket.messages].reverse().find((m) => m.sender === 'CUSTOMER');
    const inReplyTo = lastCustomer?.emailMessageId ?? undefined;
    const references = ticket.messages
      .map((m) => m.emailMessageId)
      .filter((x): x is string => !!x);

    // 1) Ulož – bez ohľadu na to, čo urobí pošta.
    const saved = await this.prisma.helpdeskMessage.create({
      data: {
        ticketId: ticket.id,
        sender: 'ADMIN',
        authorId,
        body,
        viaEmail: true,
        emailInReplyTo: inReplyTo ?? null,
      },
    });

    // 2) Pošli. Predmet stavia helpdeskSubject(), aby KROK 3 parsoval presne to,
    //    čo odtiaľto odišlo.
    const res = await this.mail.sendHelpdeskReply({
      to: ticket.customerEmail,
      subject: helpdeskSubject(ticket.ticketNumber, ticket.subject),
      text: body,
      inReplyTo,
      references: references.length > 0 ? references : undefined,
    });

    // 3) Message-ID odoslaného mailu ulož k správe. Bez neho nemá poller na čom
    //    postaviť fallback párovanie cez In-Reply-To, keď zákazník odstráni
    //    značku [HD-…] z predmetu.
    if (res.ok && res.messageId) {
      await this.prisma.helpdeskMessage.update({
        where: { id: saved.id },
        data: { emailMessageId: res.messageId },
      });
    }

    // Odpovedali sme → lopta je u zákazníka.
    await this.prisma.helpdeskTicket.update({
      where: { id: ticket.id },
      data: { status: HelpdeskStatus.PENDING, closedAt: null },
    });

    if (!res.ok) {
      this.logger.error(`Odpoveď na ${ticket.ticketNumber} uložená, e-mail zlyhal: ${res.error}`);
    }
    return {
      messageSaved: true,
      emailed: res.ok,
      ...(res.error && { error: res.error }),
      ...(res.messageId && { messageId: res.messageId }),
    };
  }

  private async assertExists(id: string) {
    const t = await this.prisma.helpdeskTicket.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException('Tiket neexistuje.');
  }
}
