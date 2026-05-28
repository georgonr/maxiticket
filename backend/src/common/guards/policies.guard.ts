import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory, JwtPayload } from '../../casl/casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
  PolicyHandlerCallback,
  PolicyHandlerType,
} from '../decorators/check-policies.decorator';
import { AppAbility } from '../../casl/casl-ability.factory';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policyHandlers = this.reflector.get<PolicyHandlerType[]>(
      CHECK_POLICIES_KEY,
      context.getHandler(),
    ) ?? [];

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const ability = this.caslAbilityFactory.createForUser(user);

    return policyHandlers.every((handler) => this.execPolicyHandler(handler, ability));
  }

  private execPolicyHandler(handler: PolicyHandlerType, ability: AppAbility): boolean {
    if (typeof handler === 'function') {
      return (handler as PolicyHandlerCallback)(ability);
    }
    return (handler as PolicyHandler).handle(ability);
  }
}
