'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-slate-800">{question}</span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-slate-600">{answer}</p>
      )}
    </div>
  );
}

export default function FaqPage() {
  const t = useTranslations('faq');
  const faqs = t.raw('items') as { question: string; answer: string }[];
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">
        {t('title')}
      </h1>
      <p className="mb-10 text-slate-500">
        {t('subtitle')}{' '}
        <a href="mailto:info@ticketall.eu" className="text-purple-600 hover:underline">
          info@ticketall.eu
        </a>
        .
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
        {faqs.map((faq) => (
          <FaqItem key={faq.question} {...faq} />
        ))}
      </div>
    </div>
  );
}
