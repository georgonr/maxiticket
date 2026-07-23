import { getTranslations } from 'next-intl/server';
import { TermsArticle } from '@/components/public/TermsArticle';
import { TermsTabs } from '@/components/public/TermsTabs';
import { getPlatformTerms } from '@/lib/terms.server';

// Server Component (krok 44): obe znenia VOP (kupujúci + organizátor) sa načítajú
// na serveri a sú v SSR HTML; klientský prepínač len mení viditeľnosť. Deep-link
// ?pre=organizator otvorí rovno organizátorský tab (odkaz z organizátorskej registrácie).
export default async function TermsPage({
  searchParams,
}: {
  searchParams: { pre?: string };
}) {
  const t = await getTranslations('terms');
  const [buyer, organizer] = await Promise.all([
    getPlatformTerms('BUYER_PURCHASE'),
    getPlatformTerms('ORGANIZER_REGISTRATION'),
  ]);
  const initial = searchParams.pre === 'organizator' ? 'organizer' : 'buyer';

  const article = (terms: Awaited<ReturnType<typeof getPlatformTerms>>) => (
    <TermsArticle
      terms={terms}
      versionLabel={(v) => t('version', { version: v })}
      effectiveLabel={(d) => t('effectiveFrom', { date: d })}
      pendingLabel={t('pending')}
    />
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-slate-900">{t('title')}</h1>
      <TermsTabs
        initial={initial}
        buyerLabel={t('tabBuyer')}
        organizerLabel={t('tabOrganizer')}
        buyer={article(buyer)}
        organizer={article(organizer)}
      />
    </div>
  );
}
