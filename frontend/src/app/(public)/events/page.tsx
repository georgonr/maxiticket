'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { publicApi, PublicShow, PublicTermin } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/format';
import {
  Search, Calendar, MapPin, LayoutGrid, CalendarDays,
  Music, Users, Dumbbell, Briefcase, Drama, Sparkles, Star,
  Loader2, ChevronDown, Share2, Copy, Check, MessageCircle,
  QrCode, Download, X, type LucideIcon,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_CHIPS = [
  { value: '',         label: 'Všetky dátumy' },
  { value: 'today',   label: 'Dnes' },
  { value: 'week',    label: 'Tento týždeň' },
  { value: 'weekend', label: 'Víkend' },
];

const FIXED_CATEGORIES = [
  { value: '',            label: 'Všetko',     Icon: Star },
  { value: 'Koncerty',    label: 'Koncerty',    Icon: Music },
  { value: 'Festivaly',   label: 'Festivaly',   Icon: Users },
  { value: 'Šport',       label: 'Šport',       Icon: Dumbbell },
  { value: 'Konferencie', label: 'Konferencie', Icon: Briefcase },
  { value: 'Divadlo',     label: 'Divadlo',     Icon: Drama },
  { value: 'Ostatné',     label: 'Ostatné',     Icon: Sparkles },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EventsPage() {
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
        date:     filterDate || undefined,
        city:     filterCity || undefined,
      })
      .then(setShows)
      .catch(() => setShows([]))
      .finally(() => setLoading(false));
  }, [filterCat, filterDate, filterCity]);

  const allCategories = [
    ...FIXED_CATEGORIES,
    ...extraCats.map((c) => ({ value: c, label: c, Icon: Sparkles })),
  ];

  return (
    <div className="-mx-4 sm:-mx-6">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-purple-800 to-violet-900 px-4 sm:px-6 py-16 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 60%, #ffffff 1px, transparent 1px),
                              radial-gradient(circle at 75% 30%, #ffffff 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-purple-200 backdrop-blur-sm">
                <Sparkles size={12} /> Vstupenky online
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
                Nájdite vaše<br />
                <span className="text-rose-400">ďalšie podujatie.</span>
              </h1>
              <p className="mt-4 text-base sm:text-lg text-purple-200 max-w-sm">
                Koncerty, festivaly, šport a konferencie na Slovensku aj v Afrike.
              </p>
            </div>
            <div className="flex-shrink-0 self-start mt-1">
              <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-sm">
                <button
                  onClick={() => setView('grid')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    view === 'grid' ? 'bg-white text-purple-800 shadow-sm' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <LayoutGrid size={14} />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  onClick={() => setView('calendar')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    view === 'calendar' ? 'bg-white text-purple-800 shadow-sm' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <CalendarDays size={14} />
                  <span className="hidden sm:inline">Kalendár</span>
                </button>
              </div>
            </div>
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

      {/* ── Filter chips + city ─────────────────────────────────────────── */}
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
                  {chip.label}
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
                <option value="">Všetky mestá</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          )}
        </div>
      </section>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-7xl">
          {!loading && shows.length > 0 && (
            <p className="mb-5 text-sm text-slate-500">
              Zobrazených{' '}
              <span className="font-semibold text-slate-700">{shows.length}</span>{' '}
              {shows.length === 1 ? 'podujatie' : shows.length < 5 ? 'podujatia' : 'podujatí'}
              {filterCat && <> v kategórii <span className="font-semibold text-purple-700">{filterCat}</span></>}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="animate-spin text-purple-600" size={36} />
            </div>
          ) : shows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-24 text-center">
              <Search size={40} className="mb-4 text-slate-300" />
              <p className="text-lg font-semibold text-slate-500">Žiadne podujatia nenájdené</p>
              <p className="mt-1 text-sm text-slate-400">Skúste zmeniť filter alebo sa vráťte neskôr.</p>
              {(filterCat || filterDate || filterCity) && (
                <button
                  onClick={() => { setFilterCat(''); setFilterDate(''); setFilterCity(''); }}
                  className="mt-5 rounded-xl bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-600 transition-colors"
                >
                  Zrušiť filtre
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shows.map((show) => (
                <ShowCard key={show.id} show={show} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ShowCard ─────────────────────────────────────────────────────────────────

function ShowCard({ show }: { show: PublicShow }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [qrOpen, setQrOpen]       = useState(false);
  const [copied, setCopied]       = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const termin: PublicTermin | undefined = show.termins[0];

  const eventUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/events/${show.slug}`
    : `https://maxiticket.africa/events/${show.slug}`;

  // Close share panel when clicking outside card
  useEffect(() => {
    if (!shareOpen) return;
    function handle(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [shareOpen]);

  function copyLink() {
    navigator.clipboard.writeText(eventUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function openWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${show.name} – ${eventUrl}`)}`,
      '_blank',
      'noopener'
    );
  }

  async function downloadPoster() {
    if (!show.coverUrl) return;
    try {
      const res = await fetch(show.coverUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${show.slug}-plagat.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(show.coverUrl, '_blank', 'noopener');
    }
  }

  return (
    <>
      <article
        ref={cardRef}
        className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300"
      >
        {/* Cover area */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-purple-100 to-violet-100">

          {/* Transparent nav overlay (behind share panel) */}
          <Link
            href={`/events/${show.slug}`}
            className="absolute inset-0 z-0"
            aria-label={show.name}
          />

          {/* Image */}
          {show.coverUrl ? (
            <Image
              src={show.coverUrl}
              alt={show.name}
              fill
              className="pointer-events-none object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            />
          ) : (
            <div className="pointer-events-none flex h-full items-center justify-center">
              <span className="text-6xl font-extrabold text-purple-200">{show.name.charAt(0)}</span>
            </div>
          )}

          {/* Category badge */}
          {show.category && (
            <span className="pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              {show.category}
            </span>
          )}

          {/* Mobile share trigger (visible only on small screens) */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareOpen((s) => !s); }}
            className="absolute top-3 right-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 md:hidden"
            aria-label="Zdieľať"
          >
            <Share2 size={13} />
          </button>

          {/* Share panel – slides up on group-hover (desktop) or shareOpen (mobile) */}
          <div
            className={`absolute inset-x-0 bottom-0 z-20 transition-transform duration-300 ease-out ${
              shareOpen ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'
            }`}
          >
            <div className="border-t border-slate-100 bg-white/95 p-3 shadow-xl backdrop-blur-md">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Zdieľať
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <ShareBtn
                  icon={copied ? Check : Copy}
                  label={copied ? 'Skopírované!' : 'Kopírovať'}
                  active={copied}
                  onClick={copyLink}
                />
                <ShareBtn icon={MessageCircle} label="WhatsApp" onClick={openWhatsApp} />
                <ShareBtn
                  icon={QrCode}
                  label="QR kód"
                  onClick={() => { setQrOpen(true); setShareOpen(false); }}
                />
                <ShareBtn
                  icon={Download}
                  label="Plagát"
                  onClick={downloadPoster}
                  disabled={!show.coverUrl}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Info section */}
        <Link
          href={`/events/${show.slug}`}
          className="block p-4 transition-colors hover:bg-slate-50/50"
        >
          <h2 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-purple-700">
            {show.name}
          </h2>

          {termin && (
            <div className="mt-2 space-y-1">
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar size={11} className="flex-shrink-0 text-purple-400" />
                {formatDate(termin.startsAt, termin.timezone, { weekday: 'short', year: undefined })}
              </p>
              {termin.city && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin size={11} className="flex-shrink-0 text-purple-400" />
                  {termin.venueName}
                  {termin.city !== termin.venueName ? `, ${termin.city}` : ''}
                </p>
              )}
            </div>
          )}

          {show.termins.length > 1 && (
            <p className="mt-1.5 text-xs font-medium text-purple-600">
              {show.termins.length} termínov
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            {termin?.minPrice != null ? (
              <span className="text-sm font-bold text-slate-900">
                od {formatPrice(termin.minPrice, termin.currency)}
              </span>
            ) : (
              <span className="text-xs text-slate-400">Cena neuvedená</span>
            )}
            <StatusBadge status={termin?.status} />
          </div>
        </Link>
      </article>

      {/* QR code modal */}
      {qrOpen && (
        <QrModal url={eventUrl} name={show.name} onClose={() => setQrOpen(false)} />
      )}
    </>
  );
}

// ─── ShareBtn ─────────────────────────────────────────────────────────────────

function ShareBtn({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) onClick(); }}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    ON_SALE:    { label: 'V predaji', cls: 'bg-emerald-100 text-emerald-700' },
    COMING_SOON:{ label: 'Čoskoro',   cls: 'bg-blue-100 text-blue-700' },
    SOLD_OUT:   { label: 'Vypredané', cls: 'bg-red-100 text-red-600' },
    CANCELLED:  { label: 'Zrušené',  cls: 'bg-slate-100 text-slate-500' },
    PAST:       { label: 'Ukončené', cls: 'bg-slate-100 text-slate-500' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── QrModal ─────────────────────────────────────────────────────────────────

function QrModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    import('qrcode').then((QRCode) => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, url, {
          width: 240,
          margin: 2,
          color: { dark: '#2D1B69', light: '#FFFFFF' },
        });
      }
    });
  }, [url]);

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xs rounded-2xl bg-white p-6 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Zavrieť"
        >
          <X size={16} />
        </button>

        <h3 className="pr-6 text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
          {name}
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">Naskenujte QR kód na zdieľanie</p>

        <div className="mt-4 flex justify-center">
          <canvas ref={canvasRef} className="rounded-xl" />
        </div>

        <p className="mt-3 break-all text-center text-[10px] text-slate-400">{url}</p>
      </div>
    </div>
  );
}
