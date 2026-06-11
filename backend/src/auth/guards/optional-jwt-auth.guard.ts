import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT guard, ktorý NEhodí 401 pri chýbajúcom/nevalidnom tokene.
 * Ak je token platný → request.user = JwtPayload; inak → undefined (guest).
 * Použité pre guest-friendly endpointy (create order, checkout, getOrder).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Vždy spusti passport stratégiu (aby sa user populoval ak token existuje),
  // ale výsledok vyhodnotíme v handleRequest bez vyhodenia chyby.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      /* chýbajúci/nevalidný token = guest, pokračujeme */
    }
    return true;
  }

  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    // Bez throw – pri chýbajúcom userovi vrátime null (guest).
    return (user || null) as TUser;
  }
}
