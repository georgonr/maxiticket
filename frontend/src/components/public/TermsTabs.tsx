'use client';

import { useState, type ReactNode } from 'react';

/**
 * Prepínač medzi znením pre kupujúcich a organizátorov (krok 44).
 *
 * Oba dokumenty sú vyrenderované na SERVERI a odovzdané ako props (buyer/organizer),
 * takže sú v SSR HTML (crawlable + odolné voči výpadku klienta) – tento klientský
 * komponent len prepína, ktorý je viditeľný. Neaktívny sa skryje cez `hidden`,
 * teda ostáva v DOM pre SEO aj bez JS (obidva sú v HTML).
 */
export function TermsTabs({
  buyer,
  organizer,
  buyerLabel,
  organizerLabel,
  initial = 'buyer',
}: {
  buyer: ReactNode;
  organizer: ReactNode;
  buyerLabel: string;
  organizerLabel: string;
  initial?: 'buyer' | 'organizer';
}) {
  const [active, setActive] = useState<'buyer' | 'organizer'>(initial);

  const tab = (key: 'buyer' | 'organizer', label: string) => (
    <button
      type="button"
      onClick={() => setActive(key)}
      aria-selected={active === key}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active === key ? 'bg-coral text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {tab('buyer', buyerLabel)}
        {tab('organizer', organizerLabel)}
      </div>
      <div className={active === 'buyer' ? '' : 'hidden'}>{buyer}</div>
      <div className={active === 'organizer' ? '' : 'hidden'}>{organizer}</div>
    </div>
  );
}
