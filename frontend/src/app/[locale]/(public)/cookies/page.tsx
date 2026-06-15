import { useTranslations } from 'next-intl';

export default function CookiesPage() {
  const t = useTranslations('cookies');
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-slate-900">{t('title')}</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-700">

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('whatTitle')}</h2>
          <p>
            {t('whatBody')}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('typesTitle')}</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t('colType')}</th>
                  <th className="px-4 py-3 font-semibold">{t('colPurpose')}</th>
                  <th className="px-4 py-3 font-semibold">{t('colDuration')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">{t('essentialType')}</td>
                  <td className="px-4 py-3 text-slate-600">{t('essentialPurpose')}</td>
                  <td className="px-4 py-3 text-slate-600">{t('essentialDuration')}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">{t('functionalType')}</td>
                  <td className="px-4 py-3 text-slate-600">{t('functionalPurpose')}</td>
                  <td className="px-4 py-3 text-slate-600">{t('functionalDuration')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            {t.rich('noTracking', {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('manageTitle')}</h2>
          <p>
            {t('manageBody')}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">{t('contactTitle')}</h2>
          <p>
            {t('contactBody')}{' '}
            <a href="mailto:info@ticketall.eu" className="text-purple-600 hover:underline">
              info@ticketall.eu
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-slate-400">{t('lastUpdated')}</p>
      </div>
    </div>
  );
}
