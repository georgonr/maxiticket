'use client';

import {
  useEffect, useState, useRef, useCallback, KeyboardEvent,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { publicApi, HeroSlideType } from '@/lib/api';
import { formatDate } from '@/lib/format';

const AUTOPLAY_MS = 6000;

// ─── Slide data helpers ────────────────────────────────────────────────────────

function slideTitle(s: HeroSlideType): string {
  return s.type === 'show' ? s.name : s.title;
}

function slideSubtitle(s: HeroSlideType): string | null {
  if (s.type === 'show') {
    const parts: string[] = [];
    if (s.startsAt) parts.push(formatDate(s.startsAt, s.timezone, { weekday: undefined, year: undefined }));
    if (s.venueName) parts.push(s.venueName);
    if (s.city) parts.push(s.city);
    return parts.join(' · ') || null;
  }
  return s.subtitle;
}

function slideCtaLabel(s: HeroSlideType): string {
  if (s.type === 'show') return 'Kúpiť lístky';
  return s.ctaLabel ?? 'Zobraziť viac';
}

function slideCtaUrl(s: HeroSlideType): string {
  return s.ctaUrl ?? '#';
}

function slideImageUrl(s: HeroSlideType): string | null {
  return s.imageUrl ?? null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div
      className="relative w-full overflow-hidden bg-slate-200"
      style={{ height: 'clamp(280px, 38vw, 520px)' }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:400%_100%]" />
    </div>
  );
}

// ─── HeroSlider ───────────────────────────────────────────────────────────────

export function HeroSlider() {
  const [slides, setSlides] = useState<HeroSlideType[] | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    publicApi.getHero()
      .then(setSlides)
      .catch(() => setSlides([]));
  }, []);

  // ── Autoplay ───────────────────────────────────────────────────────────────
  const go = useCallback((idx: number, total: number) => {
    setActive(((idx % total) + total) % total);
  }, []);

  useEffect(() => {
    if (!slides || slides.length <= 1 || paused) return;
    timerRef.current = setTimeout(() => {
      setActive((a) => (a + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [slides, active, paused]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!slides || slides.length === 0) return;
    if (e.key === 'ArrowLeft')  { go(active - 1, slides.length); e.preventDefault(); }
    if (e.key === 'ArrowRight') { go(active + 1, slides.length); e.preventDefault(); }
  }

  // ── Touch / Swipe ──────────────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || !slides) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1), slides.length);
    touchStartX.current = null;
  }

  // ── Empty / loading states ─────────────────────────────────────────────────
  if (slides === null) return <HeroSkeleton />;
  if (slides.length === 0) return null; // No slides → show nothing (grid continues)

  const slide = slides[active];

  return (
    <div
      ref={trackRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero slider"
      tabIndex={0}
      className="relative w-full overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
      style={{ height: 'clamp(280px, 38vw, 520px)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Slides ────────────────────────────────────────────────────────── */}
      {slides.map((s, i) => {
        const imgUrl = slideImageUrl(s);
        return (
          <div
            key={s.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} z ${slides.length}: ${slideTitle(s)}`}
            aria-hidden={i !== active}
            className={`absolute inset-0 transition-opacity duration-700 ${i === active ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            {/* Background image */}
            {imgUrl ? (
              <Image
                src={imgUrl}
                alt={slideTitle(s)}
                fill
                priority={i === 0}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="object-cover"
                sizes="100vw"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-800 to-violet-900" />
            )}

            {/* Overlay gradient – left for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
            {/* Bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />

            {/* Content */}
            <div className="absolute inset-0 flex items-center">
              <div className="mx-auto w-full max-w-7xl px-6 sm:px-10">
                <div className="max-w-xl">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight drop-shadow-md">
                    {slideTitle(s)}
                  </h2>
                  {slideSubtitle(s) && (
                    <p className="mt-3 text-sm sm:text-base text-white/80 drop-shadow-sm line-clamp-2">
                      {slideSubtitle(s)}
                    </p>
                  )}
                  {slideCtaUrl(s) !== '#' && (
                    <Link
                      href={slideCtaUrl(s)}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 active:bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                      tabIndex={i === active ? 0 : -1}
                    >
                      {slideCtaLabel(s)}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Arrows (desktop) ──────────────────────────────────────────────── */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(active - 1, slides.length)}
            className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/50 sm:flex"
            aria-label="Predchádzajúci slide"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => go(active + 1, slides.length)}
            className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/50 sm:flex"
            aria-label="Nasledujúci slide"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* ── Dots ──────────────────────────────────────────────────────────── */}
      {slides.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5"
          role="tablist"
          aria-label="Slide navigácia"
        >
          {slides.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === active}
              aria-label={`Prejsť na slide ${i + 1}`}
              onClick={() => go(i, slides.length)}
              className={`rounded-full transition-all duration-300 ${
                i === active
                  ? 'bg-white w-6 h-2'
                  : 'bg-white/50 hover:bg-white/75 w-2 h-2'
              }`}
            />
          ))}
        </div>
      )}

      {/* ── Live region for a11y ──────────────────────────────────────────── */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {slideTitle(slide)}, slide {active + 1} z {slides.length}
      </div>
    </div>
  );
}
