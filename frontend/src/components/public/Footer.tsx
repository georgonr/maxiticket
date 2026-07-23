import NextLink from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { RegisterChoice } from './RegisterChoice';

// Krok 31b1/3: i18n texty (namespace `footer`) + locale-aware linky. `flat` = nelokalizovaná staff cesta.
// Krok 31b3: odstránené mŕtve odkazy (o-nas/blog/cennik/podmienky/vop = 404). Ponechané funkčné stránky.
const FOOTER_COLS = [
  {
    titleKey: 'colOrganizers',
    links: [
      { href: '/pre-organizatorov', key: 'forOrganizers' },
      // FIX: /admin/register bol 404 → otvorí dialóg s výberom typu registrácie.
      { href: '#', key: 'register', dialog: true },
    ],
  },
  {
    titleKey: 'colHelp',
    links: [
      { href: '/faq', key: 'faq' },
      { href: '/kontakt', key: 'contact' },
    ],
  },
  {
    titleKey: 'colLegal',
    links: [
      { href: '/obchodne-podmienky', key: 'terms' },
      { href: '/gdpr', key: 'gdpr' },
      { href: '/cookies', key: 'cookies' },
    ],
  },
] as const;

const SOCIAL_LINKS = [
  {
    href: 'https://instagram.com/ticketall',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    href: 'https://facebook.com/ticketall',
    label: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    href: 'https://linkedin.com/company/ticketall',
    label: 'LinkedIn',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    href: 'https://tiktok.com/@ticketall',
    label: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
  },
];

export function PublicFooter() {
  const t = useTranslations('footer');
  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-8">
        {/* Main columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">

          {/* Brand column */}
          <div className="lg:col-span-1">
            {/* TicketAll Protect – kompaktný trust prvok nad logom; zelený štít ladí s logom (.eu) */}
            <Link href="/protect" className="group mb-6 inline-flex items-center gap-2.5">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#10B981] shadow-md shadow-[#10B981]/25 transition-transform group-hover:scale-105">
                <ShieldCheck size={38} className="text-white" strokeWidth={2.25} />
              </span>
              <span className="leading-tight">
                <span className="block font-display text-sm font-bold text-white">{t('protect')}</span>
                <span className="block text-xs text-slate-400">{t('protectSubtitle')}</span>
              </span>
            </Link>

            <div className="mb-4">
              <Image
                src="/logo-horizontal-footer.svg"
                alt="TicketAll"
                width={132}
                height={33}
                className="h-[1.65rem] w-auto"
              />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              {t('tagline')}
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3 mt-6">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.titleKey} className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
                {t(col.titleKey)}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link, i) => {
                  const cls = 'text-sm text-slate-400 hover:text-white transition-colors';
                  const isDialog = 'dialog' in link && link.dialog;
                  const isFlat = 'flat' in link && link.flat;
                  return (
                    <li key={`${link.href}-${i}`}>
                      {isDialog ? (
                        <RegisterChoice className={`${cls} cursor-pointer`}>{t(link.key)}</RegisterChoice>
                      ) : isFlat ? (
                        <NextLink href={link.href} className={cls}>{t(link.key)}</NextLink>
                      ) : (
                        <Link href={link.href} className={cls}>{t(link.key)}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} TicketAll. {t('rights')}
          </p>
          <a
            href="mailto:info@ticketall.eu"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            info@ticketall.eu
          </a>
        </div>
      </div>
    </footer>
  );
}
