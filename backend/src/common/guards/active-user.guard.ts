import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../casl/casl-ability.factory';

/**
 * Overuje, že prihlásený používateľ je stále aktívny (User.isActive=true).
 * JWT access token nenesie isActive, takže deaktivácia by inak začala platiť
 * až po expirácii tokenu – tento guard ju vynúti okamžite (re-check z DB).
 * Vyžaduje, aby JwtAuthGuard bežal pred ním (request.user musí byť nastavené).
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as JwtPayload | undefined;
    if (!user?.sub) return false;

    const record = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isActive: true },
    });
    if (!record || !record.isActive) {
      throw new ForbiddenException('Účet je deaktivovaný.');
    }
    return true;
  }
}
