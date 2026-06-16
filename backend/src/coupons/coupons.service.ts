import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { Prisma, CouponType, CouponScope, UserRole, Coupon } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { BulkGenerateCouponsDto } from './dto/bulk-generate-coupons.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { RedeemCouponDto } from './dto/redeem-coupon.dto';
import { generateCouponBatchPdf, CouponPdfData } from './coupon-pdf.helper';

// Alfanumerická abeceda bez zámen: žiadne 0, O, 1, I
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

// Doľaďovák 2: stabilné kódy dôvodov pre i18n na frontende (popri SK `reason`,
// ktorý ostáva kvôli spätnej kompatibilite konzumentov).
export type CouponReasonCode =
  | 'NOT_FOUND'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'MAX_USES_PER_USER'
  | 'MIN_ORDER_AMOUNT'
  | 'SCOPE_MISMATCH_ALL'
  | 'SCOPE_MISMATCH_NONE';

type ValidateResult =
  | { valid: false; reason: string; reasonCode: CouponReasonCode; minOrderAmount?: number }
  | {
      valid: true;
      discount: number;
      finalAmount: number;
      couponId: string;
      type: CouponType;
      scope: CouponScope;
    };

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // ───────────────────────── helpers ─────────────────────────

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private generateCode(): string {
    let out = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return out;
  }

  /** Vygeneruje N unikátnych kódov (kontrola kolízií voči DB aj medzi sebou). */
  private async generateUniqueCodes(n: number): Promise<string[]> {
    const result = new Set<string>();
    while (result.size < n) {
      const need = n - result.size;
      const batch = new Set<string>();
      while (batch.size < need) batch.add(this.generateCode());
      const candidates = [...batch].filter((c) => !result.has(c));
      const existing = await this.prisma.coupon.findMany({
        where: { code: { in: candidates } },
        select: { code: true },
      });
      const taken = new Set(existing.map((e) => e.code));
      for (const c of candidates) if (!taken.has(c)) result.add(c);
    }
    return [...result];
  }

  private async resolveOwnerOrganizerId(user: JwtPayload): Promise<string> {
    if (user.organizerId) return user.organizerId;
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { organizerId: true },
    });
    if (!u?.organizerId) {
      throw new ForbiddenException('Užívateľ nemá priradeného organizátora');
    }
    return u.organizerId;
  }

  /** Spoločná validácia scope + ownership pre create/bulk. Vracia normalizované scope-target IDs. */
  private async resolveScopeTargets(
    user: JwtPayload,
    scope: CouponScope,
    input: { organizerId?: string; showId?: string; ticketTypeId?: string },
  ): Promise<{ organizerId: string | null; showId: string | null; ticketTypeId: string | null }> {
    const isSuper = user.role === UserRole.SUPERADMIN;

    if (scope === CouponScope.GLOBAL) {
      if (!isSuper) throw new ForbiddenException('GLOBAL kupóny môže vytvárať iba SUPERADMIN');
      return { organizerId: null, showId: null, ticketTypeId: null };
    }

    const ownerOrgId = isSuper ? null : await this.resolveOwnerOrganizerId(user);

    if (scope === CouponScope.ORGANIZER) {
      if (!input.organizerId) throw new BadRequestException('organizerId je povinný pre scope ORGANIZER');
      const org = await this.prisma.organizer.findUnique({ where: { id: input.organizerId } });
      if (!org) throw new NotFoundException('Organizátor neexistuje');
      if (!isSuper && org.id !== ownerOrgId) {
        throw new ForbiddenException('Kupón môžete vytvoriť iba pre vlastného organizátora');
      }
      return { organizerId: org.id, showId: null, ticketTypeId: null };
    }

    if (scope === CouponScope.SHOW) {
      if (!input.showId) throw new BadRequestException('showId je povinný pre scope SHOW');
      const show = await this.prisma.show.findUnique({ where: { id: input.showId } });
      if (!show) throw new NotFoundException('Podujatie neexistuje');
      if (!isSuper && show.organizerId !== ownerOrgId) {
        throw new ForbiddenException('Kupón môžete vytvoriť iba pre vlastné podujatie');
      }
      return { organizerId: null, showId: show.id, ticketTypeId: null };
    }

    // TICKET_TYPE
    if (!input.ticketTypeId) throw new BadRequestException('ticketTypeId je povinný pre scope TICKET_TYPE');
    const tt = await this.prisma.ticketType.findUnique({
      where: { id: input.ticketTypeId },
      include: { termin: { include: { show: { select: { organizerId: true } } } } },
    });
    if (!tt) throw new NotFoundException('Typ vstupenky neexistuje');
    if (!isSuper && tt.termin.show.organizerId !== ownerOrgId) {
      throw new ForbiddenException('Kupón môžete vytvoriť iba pre vlastný typ vstupenky');
    }
    return { organizerId: null, showId: null, ticketTypeId: tt.id };
  }

  /** Normalizuje hodnotu podľa typu (FREE_TICKET = 100, validuje rozsahy). */
  private normalizeValue(type: CouponType, value: number): number {
    if (type === CouponType.FREE_TICKET) return 100;
    if (type === CouponType.PERCENTAGE) {
      if (value <= 0 || value > 100) {
        throw new BadRequestException('PERCENTAGE hodnota musí byť v rozsahu 0–100');
      }
      return value;
    }
    // FIXED_AMOUNT
    if (value <= 0) throw new BadRequestException('FIXED_AMOUNT hodnota musí byť kladná');
    return value;
  }

  // ───────────────────────── create ─────────────────────────

  async create(dto: CreateCouponDto, user: JwtPayload) {
    const targets = await this.resolveScopeTargets(user, dto.scope, dto);
    const value = this.normalizeValue(dto.type, dto.value);

    let code: string;
    if (dto.code) {
      code = dto.code.trim().toUpperCase();
      const existing = await this.prisma.coupon.findUnique({ where: { code } });
      if (existing) throw new ConflictException('Kupón s týmto kódom už existuje');
    } else {
      code = (await this.generateUniqueCodes(1))[0];
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        type: dto.type,
        value,
        scope: dto.scope,
        organizerId: targets.organizerId,
        showId: targets.showId,
        ticketTypeId: targets.ticketTypeId,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        maxUses: dto.maxUses ?? null,
        maxUsesPerUser: dto.maxUsesPerUser ?? null,
        minOrderAmount: dto.minOrderAmount ?? null,
        createdById: user.sub,
      },
    });

    return { coupon: this.serialize(coupon) };
  }

  // ───────────────────────── bulk generate ─────────────────────────

  async bulkGenerate(dto: BulkGenerateCouponsDto, user: JwtPayload) {
    if (dto.count < 1 || dto.count > 100) {
      throw new BadRequestException('count musí byť 1–100');
    }
    const targets = await this.resolveScopeTargets(user, dto.scope, dto);
    const value = this.normalizeValue(dto.type, dto.value);
    const sendTo = dto.sendToEmail ?? user.email;

    const codes = await this.generateUniqueCodes(dto.count);
    const bulkBatchId = `batch_${this.generateCode()}${this.generateCode()}`;

    await this.prisma.coupon.createMany({
      data: codes.map((code) => ({
        code,
        type: dto.type,
        value,
        scope: dto.scope,
        organizerId: targets.organizerId,
        showId: targets.showId,
        ticketTypeId: targets.ticketTypeId,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        maxUses: dto.maxUses ?? null,
        maxUsesPerUser: dto.maxUsesPerUser ?? null,
        minOrderAmount: dto.minOrderAmount ?? null,
        createdById: user.sub,
        bulkBatchId,
      })),
    });

    // PDF + email organizátorovi (NIE zákazníkom)
    const platform = await this.prisma.platformInfo.findFirst();
    const pdfData: CouponPdfData = {
      count: dto.count,
      batchId: bulkBatchId,
      generatedAt: new Date(),
      typeLabel: this.typeLabel(dto.type),
      valueLabel: this.valueLabel(dto.type, value),
      scopeLabel: this.scopeLabel(dto.scope),
      validityLabel: this.validityLabel(dto.validFrom, dto.validUntil),
      codes,
      platformName: platform?.legalName ?? 'TicketAll s.r.o.',
    };

    try {
      const pdf = await generateCouponBatchPdf(pdfData);
      await this.mail.sendCouponBatch({
        to: sendTo,
        locale: dto.locale,
        count: dto.count,
        batchId: bulkBatchId,
        typeLabel: pdfData.typeLabel,
        valueLabel: pdfData.valueLabel,
        scopeLabel: pdfData.scopeLabel,
        validityLabel: pdfData.validityLabel,
        pdf,
      });
    } catch (e) {
      // Kupóny sú už vytvorené – email zlyhanie nezhodí celý request, len zalogujeme.
      this.logger.error(`Coupon batch ${bulkBatchId} email failed: ${(e as Error).message}`);
    }

    return {
      batchId: bulkBatchId,
      count: dto.count,
      sentTo: sendTo,
      codes: codes.slice(0, 10), // preview prvých 10
    };
  }

  // ───────────────────────── list ─────────────────────────

  async list(
    user: JwtPayload,
    query: {
      scope?: string;
      status?: string;
      organizerId?: string;
      showId?: string;
      relevantToShowId?: string;
      bulkBatchId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const where: Prisma.CouponWhereInput = {};
    if (query.relevantToShowId) {
      // Show editor mód: všetky kupóny "dotýkajúce sa" daného show –
      // SHOW(showId) + TICKET_TYPE(ticketTypeId v show) + dedené ORGANIZER + GLOBAL.
      // Org-scoping zámerne neaplikujeme (dedené GLOBAL/ORG sa zobrazia ako read-only),
      // ale prístup k show overujeme rovnako ako shows.service.assertAccess.
      const show = await this.prisma.show.findUnique({
        where: { id: query.relevantToShowId },
        include: { termins: { select: { ticketTypes: { select: { id: true } } } } },
      });
      if (!show) throw new NotFoundException('Show neexistuje');
      if (user.role !== UserRole.SUPERADMIN) {
        const orgId = await this.resolveOwnerOrganizerId(user);
        if (show.organizerId !== orgId) throw new ForbiddenException();
      }
      const ttIds = show.termins.flatMap((t) => t.ticketTypes.map((tt) => tt.id));
      where.OR = [
        { showId: show.id },
        ...(ttIds.length ? [{ ticketTypeId: { in: ttIds } } as Prisma.CouponWhereInput] : []),
        { scope: CouponScope.ORGANIZER, organizerId: show.organizerId },
        { scope: CouponScope.GLOBAL },
      ];
    } else if (user.role !== UserRole.SUPERADMIN) {
      const orgId = await this.resolveOwnerOrganizerId(user);
      where.OR = [{ createdById: user.sub }, { organizerId: orgId }];
    }
    if (query.scope) where.scope = query.scope as CouponScope;
    if (query.organizerId) where.organizerId = query.organizerId;
    if (query.showId) where.showId = query.showId;
    if (query.bulkBatchId) where.bulkBatchId = query.bulkBatchId;
    if (query.search) where.code = { startsWith: query.search.trim().toUpperCase() };

    // status (active/expired/exhausted) zahŕňa porovnanie usedCount vs maxUses,
    // ktoré Prisma where nevie vyjadriť → status počítame a filtrujeme v JS.
    const CAP = 1000;
    const rows = await this.prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: CAP,
      include: {
        organizer: { select: { name: true } },
        show: { select: { name: true } },
        ticketType: { select: { name: true } },
        _count: { select: { redemptions: true } },
      },
    });
    if (rows.length === CAP) {
      this.logger.warn(`Coupon list hit cap ${CAP}; ďalšie kupóny nie sú zahrnuté vo filtri statusu`);
    }

    const now = new Date();
    const mapped = rows.map((c) => ({
      ...this.serialize(c),
      status: this.computeStatus(c, now),
      scopeTargetName:
        c.organizer?.name ?? c.show?.name ?? c.ticketType?.name ?? null,
      redemptionsCount: c._count.redemptions,
    }));

    const filtered =
      query.status && query.status !== 'all'
        ? mapped.filter((c) => c.status === query.status)
        : mapped;

    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    };
  }

  // ───────────────────────── detail ─────────────────────────

  async detail(id: string, user: JwtPayload) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        organizer: { select: { name: true } },
        show: { select: { name: true } },
        ticketType: { select: { name: true } },
        redemptions: {
          orderBy: { redeemedAt: 'desc' },
          take: 20,
          include: {
            order: { select: { orderNumber: true } },
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!coupon) throw new NotFoundException('Kupón neexistuje');
    await this.assertCanManage(coupon, user);

    return {
      ...this.serialize(coupon),
      status: this.computeStatus(coupon, new Date()),
      scopeTargetName:
        coupon.organizer?.name ?? coupon.show?.name ?? coupon.ticketType?.name ?? null,
      redemptions: coupon.redemptions.map((r) => ({
        id: r.id,
        orderNumber: r.order.orderNumber,
        userEmail: r.user?.email ?? null,
        discountAmount: Number(r.discountAmount),
        redeemedAt: r.redeemedAt,
      })),
    };
  }

  // ───────────────────────── delete ─────────────────────────

  async remove(id: string, user: JwtPayload) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Kupón neexistuje');
    await this.assertCanManage(coupon, user);

    if (coupon.usedCount > 0) {
      throw new BadRequestException(
        'Nemožno zmazať kupón ktorý už bol použitý, môžete len nastaviť validUntil v minulosti',
      );
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ───────────────────────── validate (PUBLIC) ─────────────────────────

  async validate(dto: ValidateCouponDto): Promise<ValidateResult> {
    const code = dto.code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return { valid: false, reason: 'Kupón neexistuje', reasonCode: 'NOT_FOUND' };

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      return { valid: false, reason: 'Kupón ešte nie je platný', reasonCode: 'NOT_YET_VALID' };
    }
    if (coupon.validUntil && coupon.validUntil < now) {
      return { valid: false, reason: 'Kupón už expiroval', reasonCode: 'EXPIRED' };
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, reason: 'Kupón je vyčerpaný', reasonCode: 'EXHAUSTED' };
    }
    if (coupon.maxUsesPerUser != null && dto.userId) {
      const used = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId: dto.userId },
      });
      if (used >= coupon.maxUsesPerUser) {
        return { valid: false, reason: 'Tento kupón ste už použili maximálny počet krát', reasonCode: 'MAX_USES_PER_USER' };
      }
    }
    if (coupon.minOrderAmount != null && dto.subtotal < Number(coupon.minOrderAmount)) {
      return {
        valid: false,
        reason: `Minimálna suma objednávky je ${Number(coupon.minOrderAmount)} €`,
        reasonCode: 'MIN_ORDER_AMOUNT',
        minOrderAmount: Number(coupon.minOrderAmount),
      };
    }

    // Scope kontrola + výpočet základne pre zľavu
    const ttIds = dto.items.map((i) => i.ticketTypeId);
    const ticketTypes = await this.prisma.ticketType.findMany({
      where: { id: { in: ttIds } },
      include: { termin: { include: { show: { select: { id: true, organizerId: true } } } } },
    });
    const ttMap = new Map(ticketTypes.map((t) => [t.id, t]));

    let discountBase = dto.subtotal;

    if (coupon.scope === CouponScope.ORGANIZER) {
      const allMatch = dto.items.every(
        (i) => ttMap.get(i.ticketTypeId)?.termin.show.organizerId === coupon.organizerId,
      );
      if (!allMatch) {
        return { valid: false, reason: 'Kupón sa nevzťahuje na všetky položky v košíku', reasonCode: 'SCOPE_MISMATCH_ALL' };
      }
    } else if (coupon.scope === CouponScope.SHOW) {
      const allMatch = dto.items.every(
        (i) => ttMap.get(i.ticketTypeId)?.termin.show.id === coupon.showId,
      );
      if (!allMatch) {
        return { valid: false, reason: 'Kupón sa nevzťahuje na všetky položky v košíku', reasonCode: 'SCOPE_MISMATCH_ALL' };
      }
    } else if (coupon.scope === CouponScope.TICKET_TYPE) {
      const matchItem = dto.items.find((i) => i.ticketTypeId === coupon.ticketTypeId);
      if (!matchItem) {
        return { valid: false, reason: 'Kupón sa nevzťahuje na žiadnu položku v košíku', reasonCode: 'SCOPE_MISMATCH_NONE' };
      }
      // zľava sa aplikuje IBA na daný typ vstupenky
      const tt = ttMap.get(coupon.ticketTypeId!);
      const price = tt ? Number(tt.price) : 0;
      discountBase = this.round2(price * matchItem.quantity);
    }
    // GLOBAL: discountBase = subtotal

    let discount = 0;
    if (coupon.type === CouponType.PERCENTAGE) {
      discount = discountBase * (Number(coupon.value) / 100);
    } else if (coupon.type === CouponType.FIXED_AMOUNT) {
      discount = Math.min(Number(coupon.value), discountBase);
    } else {
      // FREE_TICKET = 100 % zo základne
      discount = discountBase;
    }
    discount = Math.max(0, Math.min(this.round2(discount), dto.subtotal));
    const finalAmount = this.round2(dto.subtotal - discount);

    return {
      valid: true,
      discount,
      finalAmount,
      couponId: coupon.id,
      type: coupon.type,
      scope: coupon.scope,
    };
  }

  // ───────────────────────── redeem ─────────────────────────

  async redeem(code: string, dto: RedeemCouponDto) {
    const normalized = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({ where: { code: normalized } });
    if (!coupon) throw new NotFoundException('Kupón neexistuje');

    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Objednávka neexistuje');

    const existing = await this.prisma.couponRedemption.findUnique({
      where: { orderId: dto.orderId },
    });
    if (existing) {
      throw new ConflictException('Na túto objednávku už bol kupón uplatnený');
    }

    // subtotal = aktuálny totalAmount + už zapísaná zľava (default 0)
    const subtotal = Number(order.totalAmount) + Number(order.discountAmount);
    const discount = this.round2(Math.min(dto.discountAmount, subtotal));
    const newTotal = this.round2(subtotal - discount);

    const redemption = await this.prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
      const red = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          orderId: dto.orderId,
          userId: dto.userId ?? null,
          discountAmount: discount,
        },
      });
      await tx.order.update({
        where: { id: dto.orderId },
        data: { discountAmount: discount, totalAmount: newTotal },
      });
      return red;
    });

    return { redemptionId: redemption.id };
  }

  /**
   * Idempotentný redeem po PAID objednávke (volané z fulfillOrder po Stripe webhook / mock pay).
   * No-op ak objednávka nemá kupón alebo už bola redeemnutá. discountAmount/totalAmount
   * sú už zapísané pri initiateCheckout – tu len zaznamenáme použitie + zvýšime usedCount.
   */
  async redeemForPaidOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { couponId: true, userId: true, discountAmount: true },
    });
    if (!order?.couponId) return;

    const existing = await this.prisma.couponRedemption.findUnique({ where: { orderId } });
    if (existing) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.coupon.update({
          where: { id: order.couponId! },
          data: { usedCount: { increment: 1 } },
        });
        await tx.couponRedemption.create({
          data: {
            couponId: order.couponId!,
            orderId,
            userId: order.userId ?? null,
            discountAmount: order.discountAmount,
          },
        });
      });
      this.logger.log(`Coupon redeemed for paid order ${orderId} (coupon ${order.couponId})`);
    } catch (e) {
      // Súbeh dvoch webhookov → unique(orderId) zlyhá na druhom; bezpečne ignorujeme.
      this.logger.warn(`redeemForPaidOrder ${orderId} skipped: ${(e as Error).message}`);
    }
  }

  // ───────────────────────── shared ─────────────────────────

  private async assertCanManage(coupon: Coupon, user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN) return;
    const orgId = await this.resolveOwnerOrganizerId(user);
    const owns = coupon.createdById === user.sub || coupon.organizerId === orgId;
    if (!owns) throw new ForbiddenException('Nemáte prístup k tomuto kupónu');
  }

  private computeStatus(
    c: { validFrom: Date | null; validUntil: Date | null; usedCount: number; maxUses: number | null },
    now: Date,
  ): 'active' | 'scheduled' | 'expired' | 'exhausted' {
    if (c.validUntil && c.validUntil < now) return 'expired';
    if (c.maxUses != null && c.usedCount >= c.maxUses) return 'exhausted';
    if (c.validFrom && c.validFrom > now) return 'scheduled';
    return 'active';
  }

  private serialize(c: Coupon) {
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      value: Number(c.value),
      scope: c.scope,
      organizerId: c.organizerId,
      showId: c.showId,
      ticketTypeId: c.ticketTypeId,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      maxUses: c.maxUses,
      maxUsesPerUser: c.maxUsesPerUser,
      minOrderAmount: c.minOrderAmount != null ? Number(c.minOrderAmount) : null,
      usedCount: c.usedCount,
      createdById: c.createdById,
      bulkBatchId: c.bulkBatchId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  // labely pre PDF
  private typeLabel(t: CouponType): string {
    return t === CouponType.PERCENTAGE
      ? 'Percentuálna zľava'
      : t === CouponType.FIXED_AMOUNT
        ? 'Pevná suma'
        : 'Lístok zdarma';
  }
  private valueLabel(t: CouponType, value: number): string {
    if (t === CouponType.PERCENTAGE) return `${value} %`;
    if (t === CouponType.FIXED_AMOUNT) return `${value} €`;
    return '100 % (zdarma)';
  }
  private scopeLabel(s: CouponScope): string {
    return s === CouponScope.GLOBAL
      ? 'Celá platforma'
      : s === CouponScope.ORGANIZER
        ? 'Organizátor'
        : s === CouponScope.SHOW
          ? 'Podujatie'
          : 'Typ vstupenky';
  }
  private validityLabel(from?: string, until?: string): string {
    const f = from ? new Date(from).toLocaleDateString('sk-SK') : null;
    const u = until ? new Date(until).toLocaleDateString('sk-SK') : null;
    if (f && u) return `od ${f} do ${u}`;
    if (u) return `do ${u}`;
    if (f) return `od ${f}`;
    return 'bez časového obmedzenia';
  }
}
