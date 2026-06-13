import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, phone: true, marketingOptIn: true, role: true },
    });
    if (!u) throw new NotFoundException('Účet neexistuje.');
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null;
    return {
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      name,
      phone: u.phone,
      role: u.role,
      marketingOptIn: u.marketingOptIn,
    };
  }

  async updateNotifications(userId: string, dto: UpdateNotificationsDto) {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { marketingOptIn: dto.marketingOptIn },
      select: { marketingOptIn: true },
    });
    return { marketingOptIn: u.marketingOptIn };
  }
}
