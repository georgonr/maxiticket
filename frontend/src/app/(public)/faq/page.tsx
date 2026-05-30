'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    question: 'Ako si kúpim lístok?',
    answer:
      'Vyhľadajte podujatie na stránke Podujatia, kliknite na tlačidlo „Kúpiť lístok" a postupujte podľa krokov pokladne. Platbu môžete uskutočniť kartou alebo iným dostupným spôsobom.',
  },
  {
    question: 'Musím sa zaregistrovať, aby som mohol kúpiť lístok?',
    answer:
      'Áno, na dokončenie nákupu je potrebné mať účet v systéme Maxiticket. Registrácia je bezplatná a trvá menej ako minútu.',
  },
  {
    question: 'Kde nájdem zakúpené lístky?',
    answer:
      'Po prihlásení prejdite do sekcie Môj účet → Moje lístky. Každý lístok obsahuje QR kód, ktorý sa skenuje na vstupe.',
  },
  {
    question: 'Ako prebieha skenovanie lístka na vstupe?',
    answer:
      'Organizátor podujatia alebo pracovník vstupu naskenuje QR kód vášho lístka pomocou aplikácie Maxiticket Scanner. Lístok môžete zobraziť priamo v mobilnom prehliadači — tlač nie je nutná.',
  },
  {
    question: 'Môžem lístok vrátiť alebo vymeniť?',
    answer:
      'Podmienky vrátenia lístkov sa riadia pravidlami konkrétneho organizátora. Kontaktujte nás na info@maxiticket.sk a my vám pomôžeme situáciu riešiť.',
  },
  {
    question: 'Ako mi bude doručený lístok?',
    answer:
      'Lístok vám po úspešnej platbe automaticky zašleme e-mailom vo formáte PDF s QR kódom. Nájdete ho aj v sekcii Moje lístky po prihlásení.',
  },
  {
    question: 'Čo ak môj lístok nefunguje na vstupe?',
    answer:
      'Uistite sa, že obrazovka je dostatočne jasná a QR kód nie je poškodený. V prípade problémov kontaktujte priamo obsluhu vstupu alebo nás na info@maxiticket.sk.',
  },
  {
    question: 'Sú moje platobné údaje v bezpečí?',
    answer:
      'Platby sú spracovávané prostredníctvom certifikovaného platobného systému. Maxiticket neukladá čísla platobných kariet — všetky transakcie prebiehajú šifrovaným spojením.',
  },
];

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
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">
        Často kladené otázky
      </h1>
      <p className="mb-10 text-slate-500">
        Nenašli ste odpoveď? Napíšte nám na{' '}
        <a href="mailto:info@maxiticket.sk" className="text-purple-600 hover:underline">
          info@maxiticket.sk
        </a>
        .
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
        {FAQS.map((faq) => (
          <FaqItem key={faq.question} {...faq} />
        ))}
      </div>
    </div>
  );
}
