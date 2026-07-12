'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Search, MapPin, ChevronDown } from 'lucide-react';
import { publicApi } from '@/lib/api';

// Rovnaké hodnoty ako DATE_CHIPS na /events (API filter value; label cez events namespace).
const DATE_CHIPS = [
  { value: '',        labelKey: 'dateAll' },
  { value: 'today',   labelKey: 'dateToday' },
  { value: 'week',    labelKey: 'dateWeek' },
  { value: 'weekend', labelKey: 'dateWeekend' },
] as const;

/**
 * C3 blok 1B – vyhľadávací bar v homepage heró. Nerobí live search;
 * submit → redirect na /events s query params (q, city, date), kde existujúci
 * zoznam + backend q param prevezmú filter. Coral branding.
 */
export function HeroSearch() {
  const t = useTranslations('events');       // zdieľané labely (placeholder, mestá, dátumy)
  const tHero = useTranslations('landing.hero');
  const router = useRouter();

  const [q, setQ]       = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState('');
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    publicApi.getFilters().then((f) => setCities(f.cities ?? [])).catch(() => {});
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const query: Record<string, string> = {};
    if (q.trim()) query.q = q.trim();
    if (city) query.city = city;
    if (date) query.date = date;
    router.push({ pathname: '/events', query });
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-7 max-w-2xl">
      <div className="flex flex-col gap-2 rounded-2xl border border-plum/10 bg-white p-2 shadow-md sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-sm text-plum placeholder:text-muted focus:outline-none"
          />
        </div>

        {/* City dropdown */}
        {cities.length > 0 && (
          <div className="relative sm:border-l sm:border-plum/10">
            <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label={t('allCities')}
              className="w-full appearance-none rounded-xl bg-transparent py-2.5 pl-9 pr-8 text-sm text-plum focus:outline-none cursor-pointer sm:w-40"
            >
              <option value="">{t('allCities')}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-coral px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-coral-dark"
        >
          <Search size={16} /> {tHero('searchCta')}
        </button>
      </div>

      {/* Date chips */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {DATE_CHIPS.map((chip) => {
          const active = date === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setDate(chip.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-coral text-white shadow-sm'
                  : 'bg-white/70 border border-plum/10 text-muted hover:border-coral/40 hover:text-coral'
              }`}
            >
              {t(chip.labelKey)}
            </button>
          );
        })}
      </div>
    </form>
  );
}
