'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, MapPin } from 'lucide-react';
import { publicApi, PublicShow } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { LandingMessages } from '@/lib/landing-i18n';

const PAGE_SIZE = 12;
const ROTATE_MS = 7000;
const FADE_MS = 350;

function EventCard({ show, priceFrom }: { show: PublicShow; priceFrom: string }) {
  const term = show.termins?.[0];
  const date = term ? new Date(term.startsAt) : null;
  return (
    <Link
      href={`/events/${show.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-plum/5 transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-coral/20 to-amber/20">
        {show.coverUrl ? (
          <img src={show.coverUrl} alt={show.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-4xl text-coral/40">{show.name.charAt(0)}</div>
        )}
        {term?.minPrice != null && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-coral">
            {priceFrom} {formatPrice(term.minPrice, term.currency)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="font-display text-sm font-semibold leading-snug text-plum line-clamp-2">{show.name}</h3>
        <div className="mt-2 space-y-0.5 text-xs text-muted">
          {date && (
            <p className="flex items-center gap-1"><Calendar size={12} className="text-coral" />{date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' })}</p>
          )}
          {(term?.venueName || term?.city) && (
            <p className="flex items-center gap-1 line-clamp-1"><MapPin size={12} className="text-coral" />{term?.venueName ?? term?.city}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function FeaturedEvents({ t }: { t: LandingMessages['featured'] }) {
  const [pool, setPool] = useState<PublicShow[]>([]);
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(true);
  const hoverRef = useRef(false);

  useEffect(() => {
    publicApi.featuredShows().then(setPool).catch(() => setPool([]));
  }, []);

  const pages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
  const rotate = pool.length > PAGE_SIZE;

  useEffect(() => {
    if (!rotate) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // rešpektuj prefers-reduced-motion → statické
    const id = setInterval(() => {
      if (hoverRef.current) return; // pauza pri hover
      setVisible(false);
      setTimeout(() => {
        setPage((p) => (p + 1) % pages);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [rotate, pages]);

  if (pool.length === 0) return null;

  const items = pool.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold text-plum sm:text-4xl">{t.heading}</h2>
          <p className="mt-2 text-muted">{t.sub}</p>
        </div>
        <Link href="/events" className="hidden flex-shrink-0 items-center gap-1 text-sm font-semibold text-coral hover:text-coral-dark sm:flex">
          {t.allEvents} <ArrowRight size={16} />
        </Link>
      </div>

      <div
        onMouseEnter={() => { hoverRef.current = true; }}
        onMouseLeave={() => { hoverRef.current = false; }}
        className={`mt-8 grid grid-cols-2 gap-3 transition-opacity duration-300 sm:grid-cols-3 lg:grid-cols-4 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {items.map((s) => <EventCard key={s.id} show={s} priceFrom={t.priceFrom} />)}
      </div>

      <div className="mt-8 text-center sm:hidden">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm font-semibold text-coral">
          {t.allEvents} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
