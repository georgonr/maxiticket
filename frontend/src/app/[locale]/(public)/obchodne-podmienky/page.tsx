import { getTranslations, getFormatter } from 'next-intl/server';
import ReactMarkdown from 'react-markdown';
import { getPlatformTerms } from '@/lib/terms.server';

// Server Component (krok 42): aktívne znenie VOP (BUYER_PURCHASE, platformové) sa
// načíta na serveri a je v SSR HTML – rovnako ako /gdpr po kroku 40.
export default async function TermsPage() {
  const t = await getTranslations('terms');
  const format = await getFormatter();
  const terms = await getPlatformTerms('BUYER_PURCHASE');

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">{t('title')}</h1>

      {terms ? (
        <>
          <p className="mb-8 text-sm text-slate-400">
            {t('version', { version: terms.version })} ·{' '}
            {t('effectiveFrom', { date: format.dateTime(new Date(terms.publishedAt), { day: 'numeric', month: 'long', year: 'numeric' }) })}
          </p>
          {/* react-markdown renderuje do React elementov, NIE cez dangerouslySetInnerHTML;
              surové HTML v markdowne sa defaultne ignoruje (bez rehype-raw) → bezpečné. */}
          <article className="prose-terms space-y-4 text-sm leading-relaxed text-slate-700">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h2 className="mt-8 mb-2 text-xl font-bold text-slate-900">{children}</h2>,
                h2: ({ children }) => <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-800">{children}</h2>,
                h3: ({ children }) => <h3 className="mt-6 mb-2 text-base font-semibold text-slate-800">{children}</h3>,
                p: ({ children }) => <p className="mb-3">{children}</p>,
                ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
                a: ({ href, children }) => (
                  <a href={href} className="text-coral hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                ),
                strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
              }}
            >
              {terms.content}
            </ReactMarkdown>
          </article>
        </>
      ) : (
        // Znenie ešte nie je vložené (TermsVersion prázdna) – nezobrazuj prázdno ticho.
        <p className="mt-6 rounded-lg bg-slate-50 px-4 py-6 text-sm text-slate-500">{t('pending')}</p>
      )}
    </div>
  );
}
