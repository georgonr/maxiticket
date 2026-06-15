import { useTranslations } from 'next-intl';

export default function GdprPage() {
  const t = useTranslations('gdpr');
  const collected = t.raw('collected.items') as string[];
  const purposes = t.raw('purpose.items') as string[];
  const rights = t.raw('rights.items') as string[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-slate-900">
        {t('title')}
      </h1>
      <div className="space-y-6 text-sm leading-relaxed text-slate-700">

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('controller.heading')}</h2>
          <p>
            {t('controller.intro')} <strong>MaceT s.r.o.</strong>{t('controller.intro2')}{' '}
            {t('controller.contact')} <a href="mailto:info@ticketall.eu" className="text-purple-600 hover:underline">info@ticketall.eu</a>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('collected.heading')}</h2>
          <ul className="ml-4 list-disc space-y-1 text-slate-600">
            {collected.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('purpose.heading')}</h2>
          <ul className="ml-4 list-disc space-y-1 text-slate-600">
            {purposes.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('retention.heading')}</h2>
          <p>{t('retention.body')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('rights.heading')}</h2>
          <ul className="ml-4 list-disc space-y-1 text-slate-600">
            {rights.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p className="mt-2">
            {t('rights.requestPrefix')}{' '}
            <a href="mailto:info@ticketall.eu" className="text-purple-600 hover:underline">
              info@ticketall.eu
            </a>
            {t('rights.requestSuffix')}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('complaints.heading')}</h2>
          <p>
            {t('complaints.body')} (
            <a href="https://dataprotection.gov.sk" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
              dataprotection.gov.sk
            </a>
            ).
          </p>
        </section>

        <p className="text-xs text-slate-400">{t('lastUpdated')}</p>
      </div>
    </div>
  );
}
