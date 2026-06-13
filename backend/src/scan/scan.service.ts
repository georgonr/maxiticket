import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole, ScanResult, TicketStatus, TerminStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class ScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get hmacSecret(): string {
    return (
      this.config.get<string>('QR_HMAC_SECRET') ??
      this.config.get<string>('JWT_SECRET')!
    );
  }

  private computeHmac(ticketId: string, terminId: string, nonce: string): string {
    return createHmac('sha256', this.hmacSecret)
      .update(`${ticketId}:${terminId}:${nonce}`)
      .digest('base64url');
  }

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  private async assertTerminBelongsToOrg(terminId: string, user: JwtPayload) {
    if (this.isSuperOrStaff(user)) return;
    const termin = await this.prisma.termin.findFirst({
      where: { id: terminId, show: { organizerId: user.organizerId! } },
    });
    if (!termin) throw new ForbiddenException('Termín nepatrí vašej organizácii');
  }

  async validateScan(qrToken: string, terminId: string, user: JwtPayload, ipAddress: string) {
    // Step 1: verify requested terminId belongs to caller's organizer
    await this.assertTerminBelongsToOrg(terminId, user);

    // Step 2: find ticket by qrToken
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrToken },
      include: {
        termin: { include: { show: true } },
        ticketType: { select: { name: true } },
        order: { select: { buyerName: true, buyerEmail: true } },
        scanLogs: { orderBy: { scannedAt: 'desc' }, take: 1 },
      },
    });

    if (!ticket) throw new NotFoundException({ code: 'NOT_FOUND' });

    // Step 3: HMAC verification (timing-safe)
    const computed = this.computeHmac(ticket.id, ticket.terminId, ticket.nonce);
    let hmacValid = false;
    try {
      hmacValid = timingSafeEqual(Buffer.from(computed), Buffer.from(qrToken));
    } catch {
      hmacValid = false;
    }
    if (!hmacValid) {
      if (this.isSameTenant(ticket, user)) {
        await this.createScanLog(ticket.id, ticket.terminId, user.sub, ScanResult.INVALID_SIGNATURE, ipAddress);
      }
      throw new BadRequestException({ code: 'INVALID_SIGNATURE' });
    }

    // Step 4: cross-tenant – generic 404, no tenant details leaked
    if (!this.isSameTenant(ticket, user)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Neplatná vstupenka.' });
    }

    // Step 5: wrong termin/show (before status checks – knowing it's a different day is more useful)
    if (ticket.terminId !== terminId) {
      // Load request terminId's showId to distinguish WRONG_SHOW vs WRONG_TERMIN
      const reqTermin = await this.prisma.termin.findUnique({
        where: { id: terminId },
        select: { showId: true },
      });
      if (reqTermin && ticket.termin.show.id !== reqTermin.showId) {
        // Ticket belongs to a different show (same organizer)
        await this.createScanLog(ticket.id, terminId, user.sub, ScanResult.WRONG_EVENT, ipAddress);
        throw new ConflictException({
          code: 'WRONG_SHOW',
          message: 'Vstupenka platí na iné podujatie.',
          correctShow: {
            id: ticket.termin.show.id,
            name: ticket.termin.show.name,
            slug: (ticket.termin.show as any).slug ?? '',
          },
        });
      }
      await this.createScanLog(ticket.id, ticket.terminId, user.sub, ScanResult.WRONG_TERMIN, ipAddress);
      throw new ConflictException({
        code: 'WRONG_TERMIN',
        message: 'Vstupenka platí na iný termín tohto podujatia.',
        correctTermin: {
          id: ticket.termin.id,
          startsAt: ticket.termin.startsAt,
          showName: ticket.termin.show.name,
        },
      });
    }

    // Step 6: status checks
    if (ticket.status === TicketStatus.USED) {
      const lastScan = ticket.scanLogs[0];
      await this.createScanLog(ticket.id, terminId, user.sub, ScanResult.ALREADY_USED, ipAddress);
      throw new ConflictException({
        code: 'ALREADY_USED',
        message: 'Vstupenka už bola použitá.',
        usedAt: ticket.usedAt,
        scannedBy: lastScan?.scannedById
          ? await this.scannerName(lastScan.scannedById)
          : null,
      });
    }

    if (ticket.status === TicketStatus.CANCELLED) {
      await this.createScanLog(ticket.id, terminId, user.sub, ScanResult.CANCELLED, ipAddress);
      throw new ConflictException({ code: 'CANCELLED', message: 'Vstupenka bola zrušená.' });
    }

    if (ticket.status === TicketStatus.REFUNDED) {
      await this.createScanLog(ticket.id, terminId, user.sub, ScanResult.REFUNDED, ipAddress);
      throw new ConflictException({ code: 'REFUNDED', message: 'Vstupenka bola refundovaná.' });
    }

    // Step 7: atomic update – WHERE status=VALID guards against race condition (callback form)
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ticket.updateMany({
        where: { id: ticket.id, status: TicketStatus.VALID },
        data: { status: TicketStatus.USED, usedAt: new Date() },
      });

      if (result.count === 0) {
        // Race condition: another request already scanned this ticket between our read and write
        await tx.scanLog.create({
          data: {
            ticketId: ticket.id,
            terminId,
            scannedById: user.sub,
            result: ScanResult.ALREADY_USED,
            ipAddress,
          },
        });
        return null;
      }

      await tx.scanLog.create({
        data: {
          ticketId: ticket.id,
          terminId,
          scannedById: user.sub,
          result: ScanResult.OK,
          ipAddress,
        },
      });

      return result;
    });

    if (!updated) {
      throw new ConflictException({ code: 'ALREADY_USED', usedAt: null, scannedBy: null });
    }

    return {
      ticketId: ticket.id,
      ticketCode: ticket.id.slice(-12).toUpperCase(),
      showName: ticket.termin.show.name,
      terminStartsAt: ticket.termin.startsAt,
      ticketTypeName: ticket.ticketType?.name ?? ticket.seatSection ?? 'Vstupenka',
      buyerName: ticket.order.buyerName ?? ticket.order.buyerEmail ?? null,
      seatSection: ticket.seatSection,
      seatRow: ticket.seatRow,
      seatNumber: ticket.seatNumber,
      message: 'Vstupenka platná, vstup povolený.',
    };
  }

  async getTerminy(user: JwtPayload, showAll = false) {
    const orgFilter: Prisma.TerminWhereInput = this.isSuperOrStaff(user)
      ? {}
      : { show: { organizerId: user.organizerId! } };

    const windowFilter: Prisma.TerminWhereInput = showAll
      ? {}
      : (() => {
          const now = new Date();
          return {
            startsAt: {
              gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
              lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          };
        })();

    const terminy = await this.prisma.termin.findMany({
      where: {
        ...orgFilter,
        ...windowFilter,
        status: { in: [TerminStatus.ON_SALE, TerminStatus.SOLD_OUT] },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        show: { select: { id: true, name: true } },
        venue: { select: { name: true, city: true } },
        _count: {
          select: {
            tickets: { where: { status: { in: [TicketStatus.VALID, TicketStatus.USED] } } },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    // Fetch USED counts in one grouped query
    const terminIds = terminy.map((t) => t.id);
    const scannedCounts = terminIds.length
      ? await this.prisma.ticket.groupBy({
          by: ['terminId'],
          where: { terminId: { in: terminIds }, status: TicketStatus.USED },
          _count: true,
        })
      : [];
    const scannedMap = new Map(scannedCounts.map((r) => [r.terminId, r._count]));

    return terminy.map((t) => ({
      id: t.id,
      show: t.show,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      venue: t.venue,
      ticketCount: t._count.tickets,
      scannedCount: scannedMap.get(t.id) ?? 0,
    }));
  }

  private isSameTenant(
    ticket: { termin: { show: { organizerId: string } } },
    user: JwtPayload,
  ): boolean {
    if (this.isSuperOrStaff(user)) return true;
    return ticket.termin.show.organizerId === user.organizerId;
  }

  private async createScanLog(
    ticketId: string,
    terminId: string,
    scannedById: string,
    result: ScanResult,
    ipAddress: string,
  ) {
    await this.prisma.scanLog.create({
      data: { ticketId, terminId, scannedById, result, ipAddress },
    });
  }

  private async scannerName(userId: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!u) return null;
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
  }
}
