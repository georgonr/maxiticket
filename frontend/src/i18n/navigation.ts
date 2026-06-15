import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware navigácia (Link/usePathname/useRouter) – pre landing prepínač + lokalizované linky.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
