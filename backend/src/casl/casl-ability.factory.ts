import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { UserRole } from '@prisma/client';

export type Subjects =
  | 'Organizer'
  | 'User'
  | 'Show'
  | 'Termin'
  | 'TicketType'
  | 'Order'
  | 'Ticket'
  | 'ScanLog'
  | 'all';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'scan';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizerId?: string;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: JwtPayload): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (user.role) {
      case UserRole.SUPERADMIN:
        can('manage', 'all');
        break;

      case UserRole.STAFF:
        can('manage', 'Organizer');
        can('manage', 'Show');
        can('manage', 'Termin');
        can('manage', 'TicketType');
        can('read', 'Order');
        can('read', 'Ticket');
        can('read', 'ScanLog');
        can('manage', 'User');
        break;

      // Platformový admin – správa používateľov nižších rolí + prehľad platformy.
      // Zámerne NIE superadmin veci (žiadny 'manage all', žiadna správa organizerov nad rámec čítania).
      case UserRole.PLATFORM_ADMIN:
        can('manage', 'User');
        can('read', 'Organizer');
        can('read', 'Show');
        can('read', 'Order');
        can('read', 'Ticket');
        can('read', 'ScanLog');
        break;

      // Účtovník – len prehľad fakturácie (billing endpointy chránené @Roles).
      // Konzervatívne: čítanie organizátorov + objednávok pre kontext, nič viac.
      case UserRole.ACCOUNTANT:
        can('read', 'Organizer');
        can('read', 'Order');
        break;

      case UserRole.ORGANIZER_OWNER:
        can('manage', 'Organizer');
        can('manage', 'Show');
        can('manage', 'Termin');
        can('manage', 'TicketType');
        can('read', 'Order');
        can('read', 'Ticket');
        can('read', 'ScanLog');
        can('manage', 'User');
        break;

      case UserRole.ORGANIZER_MEMBER:
        can('read', 'Organizer');
        can('manage', 'Show');
        can('manage', 'Termin');
        can('manage', 'TicketType');
        can('read', 'Order');
        can('read', 'Ticket');
        can('read', 'ScanLog');
        break;

      case UserRole.SCANNER:
        can('read', 'Termin');
        can('scan', 'Ticket');
        can('read', 'ScanLog');
        break;

      case UserRole.CUSTOMER:
        can('read', 'Order');
        can('read', 'Ticket');
        break;
    }

    return build();
  }
}
