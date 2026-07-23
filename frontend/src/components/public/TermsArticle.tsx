import ReactMarkdown from 'react-markdown';
import type { PlatformTerms } from '@/lib/terms.server';

/**
 * Vyrenderovanie jedného znenia VOP z markdownu (krok 44). Prezentačný komponent
 * použiteľný v server aj klient kontexte (ReactMarkdown funguje v oboch).
 * react-markdown renderuje do React elementov, NIE cez dangerouslySetInnerHTML;
 * surové HTML sa defaultne ignoruje → bezpečné.
 */
export function TermsArticle({
  terms,
  versionLabel,
  effectiveLabel,
  pendingLabel,
}: {
  terms: PlatformTerms | null;
  versionLabel: (v: string) => string;
  effectiveLabel: (d: string) => string;
  pendingLabel: string;
}) {
  if (!terms) {
    return <p className="mt-6 rounded-lg bg-slate-50 px-4 py-6 text-sm text-slate-500">{pendingLabel}</p>;
  }

  const date = new Date(terms.publishedAt).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <p className="mb-8 text-sm text-slate-400">
        {versionLabel(terms.version)} · {effectiveLabel(date)}
      </p>
      <article className="space-y-4 text-sm leading-relaxed text-slate-700">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h2 className="mt-8 mb-2 text-xl font-bold text-slate-900">{children}</h2>,
            h2: ({ children }) => <h2 className="mt-8 mb-2 text-lg font-semibold text-slate-800">{children}</h2>,
            h3: ({ children }) => <h3 className="mt-6 mb-2 text-base font-semibold text-slate-800">{children}</h3>,
            p: ({ children }) => <p className="mb-3">{children}</p>,
            ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
            blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-slate-300 pl-4 text-slate-600">{children}</blockquote>,
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
  );
}
