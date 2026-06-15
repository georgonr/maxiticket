import { ReactNode } from 'react';
import { Ticket } from 'lucide-react';

export const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  STAFF: 'Interný operátor',
  ORGANIZER_OWNER: 'Organizátor (vlastník)',
  ORGANIZER_MEMBER: 'Organizátor (člen)',
  SCANNER: 'Skener',
  CUSTOMER: 'Zákazník',
};

export interface NavItem {
  label: string;
  href: string;
  roles: string[];
  icon?: ReactNode;
}

export interface NavGroup {
  title: string | null;
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
      title: null,
      items: [{ label: 'Prehľad platformy', href: '/admin/dashboard', roles: ['SUPERADMIN'] }],
    },
    {
      title: 'Podujatia',
      items: [
        { label: 'Podujatia', href: isSuper ? '/admin/shows' : '/organizer/shows', roles: ['SUPERADMIN', 'STAFF', 'ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'SCANNER'] },
        { label: 'Objednávky', href: isSuper ? '/admin/orders' : '/organizer/orders', roles: ['SUPERADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_MEMBER'] },
        { label: 'Refundy', href: isSuper ? '/admin/refunds' : '/organizer/refunds', roles: ['SUPERADMIN', 'STAFF', 'ORGANIZER_OWNER'] },
        { label: 'Miesta', href: '/organizer/venues', roles: ['ORGANIZER_OWNER', 'SUPERADMIN'] },
      ],
    },
    {
      title: 'Predaj',
      items: [
        { label: 'Pokladňa', href: '/organizer/pos', roles: ['ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'STAFF', 'SUPERADMIN'] },
      ],
    },
    {
      title: 'Tím',
      items: [
        { label: 'Tím', href: '/organizer/members', roles: ['ORGANIZER_OWNER', 'SUPERADMIN'] },
        { label: 'Skeneri', href: '/organizer/scanners', roles: ['ORGANIZER_OWNER', 'SUPERADMIN'] },
      ],
    },
    {
      title: 'Platforma',
      items: [
        { label: 'Hero slider', href: '/admin/hero', roles: ['SUPERADMIN'] },
        { label: 'Platforma', href: '/admin/platform-info', roles: ['SUPERADMIN'] },
        { label: 'Platobné brány', href: '/admin/payment-gateways', roles: ['SUPERADMIN', 'STAFF'] },
      ],
    },
    {
      title: 'Organizátor',
      items: [
        { label: 'Údaje firmy', href: '/organizer/settings', roles: ['ORGANIZER_OWNER'] },
      ],
    },
    {
      title: null,
      items: [
        { label: 'Moje lístky', href: '/account/tickets', roles: ['STAFF', 'ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'SCANNER', 'CUSTOMER'], icon: <Ticket className="h-4 w-4" /> },
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
