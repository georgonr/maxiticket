'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { publicApi, PublicShow } from '@/lib/api';
import { HeroSlider } from '@/components/public/HeroSlider';
import { EventCard, EventCardSkeleton } from '@/components/events/EventCard';
import {
  Search, Calendar, MapPin, LayoutGrid, CalendarDays,
  Music, Users, Dumbbell, Briefcase, Drama, Sparkles, Star,
  Loader2, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

// labelKey → key under `events` namespace (resolved via t() at render)
const DATE_CHIPS = [
  { value: '',        labelKey: 'dateAll' },
  { value: 'today',   labelKey: 'dateToday' },
  { value: 'week',    labelKey: 'dateWeek' },
  { value: 'weekend', labelKey: 'dateWeekend' },
];

// `value` is the API filter value (do NOT translate); `labelKey` is the UI label key.
const FIXED_CATEGORIES = [
  { value: '',            labelKey: 'cat.all',         Icon: Star },
  { value: 'Koncerty',    labelKey: 'cat.concerts',    Icon: Music },
  { value: 'Festivaly',   labelKey: 'cat.festivals',   Icon: Users },
  { value: 'Šport',       labelKey: 'cat.sport',       Icon: Dumbbell },
  { value: 'Konferencie', labelKey: 'cat.conferences', Icon: Briefcase },
  { value: 'Divadlo',     labelKey: 'cat.theatre',     Icon: Drama },
  { value: 'Ostatné',     labelKey: 'cat.other',       Icon: Sparkles },
];

function toDateStr(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const t = useTranslations('events');
  const [shows, setShows]           = useState<PublicShow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [cities, setCities]         = useState<string[]>([]);
  const [extraCats, setExtraCats]   = useState<string[]>([]);
  const [filterCat, setFilterCat]   = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [view, setView]             = useState<'grid' | 'calendar'>('grid');

  useEffect(() => {
    publicApi.getFilters().then((f) => {
      setCities(f.cities ?? []);
      const fixedVals = FIXED_CATEGORIES.map((c) => c.value).filter(Boolean);
      setExtraCats((f.categories ?? []).filter((c) => !fixedVals.includes(c)));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    publicApi
      .listShows({
        category: filterCat || undefined,
        // Calendar view needs all dates to mark dots correctly
        date:     view === 'calendar' ? undefined : (filterDate || undefined),
        city:     filterCity || undefined,
      })
      .then(setShows)
      .catch(() => setShows([]))
      .finally(() => setLoading(false));
  }, [filterCat, filterDate, filterCity, view]);

  const allCategories = [
    // Fixed categories: translate label via labelKey. Extra (DB) categories: keep raw value as label.
    ...FIXED_CATEGORIES.map(({ value, labelKey, Icon }) => ({ value, label: t(labelKey), Icon })),
    ...extraCats.map((c) => ({ value: c, label: c, Icon: Sparkles })),
  ];

  return (
    <div className="-mx-4 sm:-mx-6">

      {/* ── Hero Slider ──────────────────────────────────────────────────── */}
      <HeroSlider />

      {/* ── Subheader: title + Grid/Calendar toggle ───────────────────── */}
      <section className="bg-white border-b border-slate-100 px-4 sm:px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            {t('title')}
          </h1>
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setView('grid')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:inline">{t('viewGrid')}</span>
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarDays size={13} />
              <span className="hidden sm:inline">{t('viewCalendar')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Category pills ──────────────────────────────────────────────── */}
      <section className="bg-white border-b border-slate-100 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex gap-2 overflow-x-auto py-4 scrollbar-hide">
            {allCategories.map(({ value, label, Icon }) => {
              const active = filterCat === value;
              return (
                <button
                  key={value}
                  onClick={() => setFilterCat(value)}
                  className={`flex flex-none items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                    active
                      ? 'bg-purple-700 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Filter chips + city (grid only) ─────────────────────────────── */}
      {view === 'grid' && (
        <section className="bg-slate-50 border-b border-slate-100 px-4 sm:px-6 py-3">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {DATE_CHIPS.map((chip) => {
                const active = filterDate === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => setFilterDate(chip.value)}
                    className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? 'bg-purple-100 text-purple-700 border border-purple-300'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {chip.value && <Calendar size={11} />}
                    {t(chip.labelKey)}
                  </button>
                );
              })}
            </div>
            <div className="flex-1" />
            {cities.length > 0 && (
              <div className="relative">
                <MapPin size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  className="appearance-none rounded-full border border-slate-200 bg-white pl-7 pr-7 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 focus:outline-none focus:border-purple-400 transition-colors cursor-pointer"
                >
                  <option value="">{t('allCities')}</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            view === 'calendar' ? (
              <div className="flex justify-center py-24">
                <Loader2 className="animate-spin text-purple-600" size={36} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <EventCardSkeleton key={i} />
                ))}
              </div>
            )
          ) : view === 'calendar' ? (
            <CalendarView shows={shows} filterCity={filterCity} cities={cities} setFilterCity={setFilterCity} />
          ) : shows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-24 text-center">
              <Search size={40} className="mb-4 text-slate-300" />
              <p className="text-lg font-semibold text-slate-500">{t('emptyTitle')}</p>
              <p className="mt-1 text-sm text-slate-400">{t('emptyHint')}</p>
              {(filterCat || filterDate || filterCity) && (
                <button
                  onClick={() => { setFilterCat(''); setFilterDate(''); setFilterCity(''); }}
                  className="mt-5 rounded-xl bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-600 transition-colors"
                >
                  {t('clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-slate-500">
                {t.rich('resultsCount', {
                  count: shows.length,
                  b: (chunks) => <span className="font-semibold text-slate-700">{chunks}</span>,
                })}
                {filterCat && (
                  <>
                    {' '}
                    {t.rich('inCategory', {
                      cat: filterCat,
                      b: (chunks) => <span className="font-semibold text-purple-700">{chunks}</span>,
                    })}
                  </>
                )}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shows.map((show) => (
                  <EventCard key={show.id} show={show} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({
  shows,
  filterCity,
  cities,
  setFilterCity,
}: {
  shows: PublicShow[];
  filterCity: string;
  cities: string[];
  setFilterCity: (c: string) => void;
}) {
  const t = useTranslations('events');
  const format = useFormatter();
  const today = new Date();
  const [calMonth, setCalMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year  = calMonth.getFullYear();
  const month = calMonth.getMonth();

  const todayStr = toDateStr(today.toISOString());

  // Build date → shows map from loaded shows
  const showsByDate = useMemo(() => {
    const map: Record<string, PublicShow[]> = {};
    for (const show of shows) {
      for (const termin of show.termins) {
        const d = toDateStr(termin.startsAt);
        if (!map[d]) map[d] = [];
        if (!map[d].find((s) => s.id === show.id)) map[d].push(show);
      }
    }
    return map;
  }, [shows]);

  // Calendar grid cells: null = padding, number = day
  const cells = useMemo(() => {
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [year, month]);

  // Locale-aware short weekday headers, Monday-first (2024-01-01 is a Monday).
  const dayHeaders = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      format.dateTime(new Date(2024, 0, 1 + i), { weekday: 'short' }),
    ),
    [format],
  );

  function dayStr(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function prevMonth() { setCalMonth(new Date(year, month - 1, 1)); setSelectedDay(null); }
  function nextMonth() { setCalMonth(new Date(year, month + 1, 1)); setSelectedDay(null); }

  const selectedShows = selectedDay
    ? (showsByDate[selectedDay] ?? [])
    : [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

      {/* Calendar card */}
      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label={t('prevMonth')}
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-sm font-semibold text-slate-900">
              {format.dateTime(calMonth, { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label={t('nextMonth')}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {dayHeaders.map((d, i) => (
              <div key={i} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />;
              const ds         = dayStr(day);
              const hasShows   = !!showsByDate[ds]?.length;
              const isToday    = ds === todayStr;
              const isSelected = ds === selectedDay;
              const isPast     = ds < todayStr;

              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDay(isSelected ? null : ds)}
                  className={`relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-purple-700 text-white shadow-md'
                      : isToday
                      ? 'ring-2 ring-purple-400 text-slate-900 hover:bg-purple-50'
                      : hasShows
                      ? 'text-slate-900 hover:bg-purple-50 font-semibold'
                      : isPast
                      ? 'text-slate-300 cursor-default'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  disabled={!hasShows && !isSelected}
                >
                  {day}
                  {hasShows && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-purple-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" /> {t('legendEvents')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-purple-400" /> {t('legendToday')}
            </span>
          </div>
        </div>

        {/* City filter for calendar */}
        {cities.length > 0 && (
          <div className="mt-4 relative">
            <MapPin size={12} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-8 py-2.5 text-sm text-slate-600 hover:border-slate-300 focus:outline-none focus:border-purple-400 transition-colors cursor-pointer"
            >
              <option value="">{t('allCities')}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        )}
      </div>

      {/* Day detail */}
      <div className="lg:col-span-2">
        {!selectedDay ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-center p-8">
            <CalendarDays size={40} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">{t('calPickDay')}</p>
            <p className="mt-1 text-xs text-slate-400">{t('calPickDayHint')}</p>
          </div>
        ) : (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-700">
              {format.dateTime(
                (() => { const [y, m, d] = selectedDay.split('-').map(Number); return new Date(y, m - 1, d); })(),
                { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
              )}
            </h3>

            {selectedShows.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                <Search size={32} className="mb-3 text-slate-300" />
                <p className="text-sm text-slate-500">{t('noEventsThisDay')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedShows.map((show) => (
                  <CalendarShowRow key={show.id} show={show} selectedDay={selectedDay} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CalendarShowRow ──────────────────────────────────────────────────────────

function CalendarShowRow({ show, selectedDay }: { show: PublicShow; selectedDay: string }) {
  const t = useTranslations('events');
  const format = useFormatter();
  // Find the termin matching the selected day
  const termin = show.termins.find((tm) => toDateStr(tm.startsAt) === selectedDay) ?? show.termins[0];

  return (
    <Link
      href={`/events/${show.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:border-purple-200 hover:shadow-md transition-all"
    >
      {/* Thumbnail */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 to-violet-100">
        {show.coverUrl ? (
          <Image
            src={show.coverUrl}
            alt={show.name}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-lg font-bold text-purple-300">{show.name.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors line-clamp-1 text-sm">
          {show.name}
        </h4>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {termin && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar size={10} className="text-purple-400" />
              {format.dateTime(new Date(termin.startsAt), {
                timeZone: termin.timezone,
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
          {termin?.city && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={10} className="text-purple-400" />
              {termin.city}
            </span>
          )}
        </div>
      </div>

      {/* Price + arrow */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        {termin?.minPrice != null && (
          <span className="text-sm font-bold text-slate-900">
            {t('priceFrom', {
              price: format.number(termin.minPrice, { style: 'currency', currency: termin.currency }),
            })}
          </span>
        )}
        <span className="flex items-center gap-0.5 text-xs font-medium text-purple-600 group-hover:gap-1.5 transition-all">
          {t('detail')} <ChevronRight size={12} />
        </span>
      </div>
    </Link>
  );
}
