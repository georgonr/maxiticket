import { getTranslations } from 'next-intl/server';
import { Mail, MapPin } from 'lucide-react';
import { OperatorDetails } from '@/components/public/OperatorDetails';
import { ContactForm } from '@/components/public/ContactForm';
import { getPlatformInfo } from '@/lib/platform-info.server';

// Server Component (krok 40): údaje prevádzkovateľa sa načítajú na serveri a sú
// v SSR HTML. Interaktívny formulár je vyčlenený do klientskeho <ContactForm/>.
export default async function KontaktPage() {
  const t = await getTranslations('contact');
  const operator = await getPlatformInfo();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">{t('title')}</h1>
      <p className="mb-12 text-slate-500">{t('subtitle')}</p>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Formulár (klientský) */}
        <div>
          <ContactForm />
        </div>

        {/* Údaje prevádzkovateľa (zo servera) */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-800">{t('details.title')}</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail size={16} className="mt-0.5 flex-shrink-0 text-purple-500" />
                <div>
                  <p className="text-xs font-medium text-slate-500">{t('details.emailLabel')}</p>
                  {operator?.contactEmail && (
                    <a href={`mailto:${operator.contactEmail}`} className="text-sm text-slate-800 hover:text-purple-600 transition-colors">
                      {operator.contactEmail}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 flex-shrink-0 text-purple-500" />
                <div>
                  <p className="text-xs font-medium text-slate-500">{t('details.addressLabel')}</p>
                  <OperatorDetails info={operator} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-base font-semibold text-slate-800">{t('operator.title')}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{t('operator.body')}</p>
            <div className="mt-3">
              <OperatorDetails info={operator} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
