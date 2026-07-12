'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import {
  Calendar, MapPin, Share2, Copy, Check, MessageCircle, QrCode, X,
  type LucideIcon,
} from 'lucide-react';
import { PublicShow, PublicTermin } from '@/lib/api';

/**
 * Zjednotená karta podujatia (C3 blok 1A) – jeden zdroj pre homepage
 * (FeaturedEvents) aj verejný zoznam (/events). Nadmnožina pôvodných dvoch
 * kariet: next/image cover, kategória badge, status badge, cena, dátum+miesto,
 * share panel + QR modal (zdieľanie URL podujatia, „odoslať podujatie").
 *
 * Pomer coveru = aspect-square: API `coverUrl` je `squareUrl` (štvorcový asset),
 * takže square nedeformuje/neoreže obrázok a zhoduje sa s hustým zoznamom.
 * Branding: coral/plum/cream/amber tokeny (žiadny purple-700 rozkol).
 */
export function EventCard({ show }: { show: PublicShow }) {
  const t = useTranslations('events');
  const format = useFormatter();
  const [shareOpen, setShareOpen] = useState(false);
  const [qrOpen, setQrOpen]       = useState(false);
  const [copied, setCopied]       = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const termin: PublicTermin | undefined = show.termins[0];

  const eventUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/events/${show.slug}`
    : `https://ticketall.eu/events/${show.slug}`;

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
    const datum = termin
      ? format.dateTime(new Date(termin.startsAt), {
          timeZone: termin.timezone,
          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '';
    const text = `${t('shareText', { name: show.name, url: eventUrl })}${datum ? ' ' + datum : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  return (
    <>
      <article
        ref={cardRef}
        className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:border-coral/30 transition-all duration-300"
      >
        {/* Cover area */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-coral/15 to-amber/15">
          <Link href={`/events/${show.slug}`} className="absolute inset-0 z-0" aria-label={show.name} />

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
              <span className="font-display text-6xl font-extrabold text-coral/30">{show.name.charAt(0)}</span>
            </div>
          )}

          {show.category && (
            <span className="pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              {show.category}
            </span>
          )}

          {/* Mobile share trigger */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareOpen((s) => !s); }}
            className="absolute top-3 right-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 md:hidden"
            aria-label={t('share')}
          >
            <Share2 size={13} />
          </button>

          {/* Share panel (hover na desktope, tap na mobile) */}
          <div className={`absolute inset-x-0 bottom-0 z-20 transition-transform duration-300 ease-out ${
            shareOpen ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'
          }`}>
            <div className="border-t border-slate-100 bg-white/95 p-3 shadow-xl backdrop-blur-md">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t('share')}</p>
              <div className="grid grid-cols-3 gap-1.5">
                <ShareBtn icon={copied ? Check : Copy} label={copied ? t('copied') : t('copy')} active={copied} onClick={copyLink} />
                <ShareBtn icon={MessageCircle} label={t('whatsapp')} onClick={openWhatsApp} />
                <ShareBtn icon={QrCode} label={t('qrCode')} onClick={() => { setQrOpen(true); setShareOpen(false); }} />
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <Link href={`/events/${show.slug}`} className="block p-4 transition-colors hover:bg-cream/40">
          <h2 className="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-snug text-plum transition-colors group-hover:text-coral">
            {show.name}
          </h2>
          {termin && (
            <div className="mt-2 space-y-1">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Calendar size={11} className="flex-shrink-0 text-coral" />
                {format.dateTime(new Date(termin.startsAt), {
                  timeZone: termin.timezone,
                  weekday: 'short', day: 'numeric', month: 'long',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              {termin.city && (
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <MapPin size={11} className="flex-shrink-0 text-coral" />
                  {termin.venueName}{termin.city !== termin.venueName ? `, ${termin.city}` : ''}
                </p>
              )}
            </div>
          )}
          {show.termins.length > 1 && (
            <p className="mt-1.5 text-xs font-medium text-coral">{t('terminCount', { count: show.termins.length })}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            {termin?.minPrice != null ? (
              <span className="text-sm font-bold text-plum">{t('priceFrom', {
                price: format.number(termin.minPrice, { style: 'currency', currency: termin.currency }),
              })}</span>
            ) : (
              <span className="text-xs text-muted">{t('priceUnspecified')}</span>
            )}
            <StatusBadge status={termin?.status} />
          </div>
        </Link>
      </article>

      {qrOpen && <QrModal url={eventUrl} name={show.name} onClose={() => setQrOpen(false)} />}
    </>
  );
}

// ─── ShareBtn ─────────────────────────────────────────────────────────────────

function ShareBtn({ icon: Icon, label, onClick, disabled = false, active = false }: {
  icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) onClick(); }}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
        active ? 'bg-emerald-50 text-emerald-700' : 'text-plum hover:bg-coral/10 hover:text-coral'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const t = useTranslations('events');
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    ON_SALE:    { label: t('status.onSale'),     cls: 'bg-emerald-100 text-emerald-700' },
    COMING_SOON:{ label: t('status.comingSoon'), cls: 'bg-blue-100 text-blue-700' },
    SOLD_OUT:   { label: t('status.soldOut'),    cls: 'bg-red-100 text-red-600' },
    CANCELLED:  { label: t('status.cancelled'),  cls: 'bg-slate-100 text-slate-500' },
    PAST:       { label: t('status.past'),       cls: 'bg-slate-100 text-slate-500' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── EventCardSkeleton ────────────────────────────────────────────────────────

export function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-100" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-slate-100 rounded-full w-3/4" />
        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
        <div className="h-3 bg-slate-100 rounded-full w-2/3" />
        <div className="mt-3 flex items-center justify-between">
          <div className="h-4 bg-slate-100 rounded-full w-20" />
          <div className="h-5 bg-slate-100 rounded-full w-16" />
        </div>
      </div>
    </div>
  );
}

// ─── QrModal (zdieľanie URL podujatia ako QR) ─────────────────────────────────

function QrModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const t = useTranslations('events');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    import('qrcode').then((QRCode) => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, url, {
          width: 240, margin: 2,
          color: { dark: '#211A2B', light: '#FFFFFF' },
        });
      }
    });
  }, [url]);

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
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label={t('close')}>
          <X size={16} />
        </button>
        <h3 className="pr-6 text-sm font-semibold text-plum line-clamp-2 leading-snug">{name}</h3>
        <p className="mt-0.5 text-xs text-muted">{t('qrScanHint')}</p>
        <div className="mt-4 flex justify-center">
          <canvas ref={canvasRef} className="rounded-xl" />
        </div>
        <p className="mt-3 break-all text-center text-[10px] text-slate-400">{url}</p>
      </div>
    </div>
  );
}
