'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { publicApi, PublicShow } from '@/lib/api';
import { EventCard } from '@/components/events/EventCard';

const PAGE_SIZE = 12;
const ROTATE_MS = 10000;
const FADE_MS = 350;

export function FeaturedEvents() {
  const t = useTranslations('landing.featured');
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
          <h2 className="font-display text-3xl font-semibold text-plum sm:text-4xl">{t('heading')}</h2>
          <p className="mt-2 text-muted">{t('sub')}</p>
        </div>
        <Link href="/events" className="hidden flex-shrink-0 items-center gap-1 text-sm font-semibold text-coral hover:text-coral-dark sm:flex">
          {t('allEvents')} <ArrowRight size={16} />
        </Link>
      </div>

      <div
        onMouseEnter={() => { hoverRef.current = true; }}
        onMouseLeave={() => { hoverRef.current = false; }}
        className={`mt-8 grid grid-cols-2 gap-3 transition-opacity duration-300 sm:grid-cols-3 lg:grid-cols-4 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {items.map((s) => <EventCard key={s.id} show={s} />)}
      </div>

      <div className="mt-8 text-center sm:hidden">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm font-semibold text-coral">
          {t('allEvents')} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
