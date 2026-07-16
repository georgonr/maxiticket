import { ReactNode } from 'react';
import { Ticket } from 'lucide-react';

// Krok 31c1: i18n – role + nav labely sa prekladajú v Sidebare cez useTranslations
// (namespace organizer.roles.* / organizer.nav.*). Tu sú už len kľúče.
export const ROLE_KEYS = [
  'SUPERADMIN',
  'PLATFORM_ADMIN',
  'ACCOUNTANT',
  'STAFF',
  'ORGANIZER_OWNER',
  'ORGANIZER_MEMBER',
  'SCANNER',
  'CUSTOMER',
];

export interface NavItem {
  /** kľúč do organizer.nav.* */
  labelKey: string;
  href: string;
  roles: string[];
  icon?: ReactNode;
}

export interface NavGroup {
  /** kľúč do organizer.nav.* (group*) alebo null pre neoznačenú skupinu */
  titleKey: string | null;
  items: NavItem[];
}

/**
 * Zdrojom pravdy pre staff navigáciu – role[] filtre 1:1 prevzaté z pôvodného
 * DashboardHeader (Úloha 11/12-fix), len zoskupené do logických sekcií.
 * `href` závisí od roly tam, kde pôvodne závisel (SUPERADMIN cross-org cesty).
 */
export function buildNavGroups(role: string): NavGroup[] {
  const isSuper = role === 'SUPERADMIN';
  const groups: NavGroup[] = [
    {
      titleKey: null,
      items: [
        // Krok D: správa používateľov je prvá položka admin menu.
        { labelKey: 'users', href: '/admin/users', roles: ['SUPERADMIN', 'PLATFORM_ADMIN'] },
        { labelKey: 'platformOverview', href: '/admin/dashboard', roles: ['SUPERADMIN'] },
      ],
    },
    {
      titleKey: 'groupEvents',
      items: [
        { labelKey: 'shows', href: isSuper ? '/admin/shows' : '/organizer/shows', roles: ['SUPERADMIN', 'STAFF', 'ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'SCANNER'] },
        { labelKey: 'orders', href: isSuper ? '/admin/orders' : '/organizer/orders', roles: ['SUPERADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_MEMBER'] },
        { labelKey: 'refunds', href: isSuper ? '/admin/refunds' : '/organizer/refunds', roles: ['SUPERADMIN', 'STAFF', 'ORGANIZER_OWNER'] },
        { labelKey: 'venues', href: '/organizer/venues', roles: ['ORGANIZER_OWNER', 'SUPERADMIN'] },
      ],
    },
    {
      titleKey: 'groupSales',
      items: [
        { labelKey: 'pos', href: '/organizer/pos', roles: ['ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'STAFF', 'SUPERADMIN'] },
      ],
    },
    {
      titleKey: 'groupTeam',
      items: [
        { labelKey: 'members', href: '/organizer/members', roles: ['ORGANIZER_OWNER', 'SUPERADMIN'] },
        { labelKey: 'scanners', href: '/organizer/scanners', roles: ['ORGANIZER_OWNER', 'SUPERADMIN'] },
      ],
    },
    {
      titleKey: 'groupPlatform',
      items: [
        { labelKey: 'organizers', href: '/admin/organizers', roles: ['SUPERADMIN', 'STAFF'] },
        { labelKey: 'billing', href: '/admin/billing', roles: ['SUPERADMIN', 'STAFF', 'ACCOUNTANT'] },
        { labelKey: 'heroSlider', href: '/admin/hero', roles: ['SUPERADMIN'] },
        { labelKey: 'platformInfo', href: '/admin/platform-info', roles: ['SUPERADMIN'] },
        { labelKey: 'paymentGateways', href: '/admin/payment-gateways', roles: ['SUPERADMIN', 'STAFF'] },
        { labelKey: 'aiConversations', href: '/admin/ai-conversations', roles: ['SUPERADMIN'] },
        { labelKey: 'telegram', href: '/admin/telegram-settings', roles: ['SUPERADMIN'] },
      ],
    },
    {
      titleKey: 'groupOrganizer',
      items: [
        { labelKey: 'companyData', href: '/organizer/settings', roles: ['ORGANIZER_OWNER'] },
      ],
    },
    {
      titleKey: null,
      items: [
        { labelKey: 'myTickets', href: '/account/tickets', roles: ['STAFF', 'ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'SCANNER', 'CUSTOMER'], icon: <Ticket className="h-4 w-4" /> },
      ],
    },
  ];

  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}

/** "Skenovať" CTA – externý skener (zachované z pôvodného headera). */
export function showsScanCta(role: string): boolean {
  return role === 'ORGANIZER_OWNER' || role === 'ORGANIZER_MEMBER' || role === 'SCANNER';
}

export const SCANNER_URL = 'https://skener.ticketall.eu';
