'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import Image from 'next/image';
import { Link, useRouter } from '@/i18n/navigation';
import { publicApi, PublicShowDetail, PublicTerminDetail, PublicSeatSection } from '@/lib/api';
import { setCart, Cart, CartItem } from '@/lib/cart';
import { SeatPicker } from '@/components/seatmaps/SeatPicker';
import { QrTicketShare } from '@/components/qr/QrTicketShare';
import {
  Calendar, MapPin, Clock, Loader2, Plus, Minus, ShoppingCart,
  ChevronRight, ChevronLeft, Tag, AlertCircle, AlertTriangle, CheckCircle2,
  Share2, Copy, Check, MessageCircle,
} from 'lucide-react';

export default function EventDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const router = useRouter();
  const t = useTranslations('eventDetail');
  const format = useFormatter();

  const [show, setShow]                   = useState<PublicShowDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedTermin, setSelectedTermin] = useState<PublicTerminDetail | null>(null);
  const [quantities, setQuantities]       = useState<Record<string, number>>({});
  const [coverIdx, setCoverIdx]           = useState(0);
  const [copied, setCopied]               = useState(false);
  // Úloha 22/3b: SEATED sedadlá – načítané sekcie s plánikom + vybrané sedadlá per sekcia.
  const [seatData, setSeatData]           = useState<PublicSeatSection[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Record<string, Set<string>>>({});
  const [openPicker, setOpenPicker]       = useState<string | null>(null);

  useEffect(() => {
    publicApi
      .getShow(slug)
      .then((s) => {
        setShow(s);
        if (s.termins.length > 0) setSelectedTermin(s.termins[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Načítaj sedadlá SEATED sekcií pri zmene termínu (len SEATMAP).
  useEffect(() => {
    setSelectedSeats({});
    setOpenPicker(null);
    if (selectedTermin?.mode === 'SEATMAP') {
      publicApi.getTerminSeats(selectedTermin.id).then((r) => setSeatData(r.sections)).catch(() => setSeatData([]));
    } else {
      setSeatData([]);
    }
  }, [selectedTermin]);

  function adjustQty(ttId: string, delta: number, max: number) {
    setQuantities((prev) => {
      const cur = prev[ttId] ?? 0;
      const next = Math.max(0, Math.min(cur + delta, max));
      return { ...prev, [ttId]: next };
    });
  }

  function toggleSeat(terminSectionId: string, seatId: string) {
    setSelectedSeats((prev) => {
      const cur = new Set(prev[terminSectionId] ?? []);
      if (cur.has(seatId)) cur.delete(seatId); else cur.add(seatId);
      return { ...prev, [terminSectionId]: cur };
    });
  }

  function seatsTotalCount() {
    return Object.values(selectedSeats).reduce((n, s) => n + s.size, 0);
  }

  function canAddToCart() {
    return Object.values(quantities).some((q) => q > 0) || seatsTotalCount() > 0;
  }

  function addToCart() {
    if (!selectedTermin || !show || !canAddToCart()) return;
    // SEATMAP: SECTIONED po množstve, SEATED po konkrétnych sedadlách. GENERAL po typoch lístkov.
    let items: CartItem[];
    if (selectedTermin.mode === 'SEATMAP') {
      items = [];
      // SECTIONED sekcie – stepper množstvo
      for (const s of selectedTermin.sections) {
        if (s.sectionMode === 'SECTIONED' && (quantities[s.id] ?? 0) > 0) {
          items.push({ terminSectionId: s.id, quantity: quantities[s.id], name: s.name, price: s.price, currency: s.currency });
        }
      }
      // SEATED sekcie – vybrané sedadlá
      for (const sec of seatData) {
        const sel = selectedSeats[sec.id];
        if (sel && sel.size > 0) {
          const seatIds = Array.from(sel);
          const seatLabels = sec.rows.flatMap((r) =>
            r.seats.filter((st) => sel.has(st.id)).map((st) => `${r.label}${st.label}`),
          );
          items.push({ terminSectionId: sec.id, seatIds, seatLabels, quantity: seatIds.length, name: sec.name, price: sec.price, currency: sec.currency });
        }
      }
    } else {
      items = selectedTermin.ticketTypes
        .filter((tt) => (quantities[tt.id] ?? 0) > 0)
        .map((tt) => ({
          ticketTypeId: tt.id,
          quantity: quantities[tt.id],
          name: tt.name,
          price: tt.price,
          currency: tt.currency,
        }));
    }
    const cart: Cart = {
      terminId: selectedTermin.id,
      showSlug: show.slug,
      showName: show.name,
      startsAt: selectedTermin.startsAt,
      timezone: selectedTermin.timezone,
      venueName: selectedTermin.venue.name,
      city: selectedTermin.venue.city ?? '',
      items,
    };
    setCart(cart);
    router.push('/checkout');
  }

  function copyLink() {
    const url = `${window.location.origin}/events/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Loading / not-found ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={40} />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="mb-4 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-700">{t('notFoundTitle')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('notFoundDesc')}</p>
        <Link
          href="/events"
          className="mt-6 rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-600 transition-colors"
        >
          {t('backToEvents')}
        </Link>
      </div>
    );
  }

  const coverImages = show.images.filter((i) => i.squareUrl || i.url);
  const totalQty    = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalPrice  = selectedTermin
    ? (selectedTermin.mode === 'SEATMAP'
        ? selectedTermin.sections
            .filter((s) => s.sectionMode === 'SECTIONED')
            .reduce((sum, s) => sum + s.price * (quantities[s.id] ?? 0), 0)
          + seatData.reduce((sum, sec) => sum + sec.price * (selectedSeats[sec.id]?.size ?? 0), 0)
        : selectedTermin.ticketTypes.reduce((sum, tt) => sum + tt.price * (quantities[tt.id] ?? 0), 0))
    : 0;
  const totalCurrency = (selectedTermin?.mode === 'SEATMAP'
    ? selectedTermin?.sections[0]?.currency
    : selectedTermin?.ticketTypes[0]?.currency) ?? 'EUR';

  return (
    <div>
      {/* Podujatie zrušené – banner nad obsahom */}
      {show.status === 'CANCELLED' && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{t('cancelledBanner')}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/events" className="hover:text-purple-700 transition-colors">{t('breadcrumbEvents')}</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 font-medium line-clamp-1">{show.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

        {/* ── Left: Gallery + Description ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Main image */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 aspect-video">
            {coverImages.length > 0 ? (
              <Image
                src={coverImages[coverIdx].squareUrl ?? coverImages[coverIdx].url}
                alt={show.name}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-8xl font-extrabold text-purple-200">{show.name.charAt(0)}</span>
              </div>
            )}

            {/* Prev / next arrows */}
            {coverImages.length > 1 && (
              <>
                <button
                  onClick={() => setCoverIdx((i) => (i - 1 + coverImages.length) % coverImages.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
                  aria-label={t('prevImage')}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCoverIdx((i) => (i + 1) % coverImages.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
                  aria-label={t('nextImage')}
                >
                  <ChevronRight size={18} />
                </button>

                {/* Dot indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {coverImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCoverIdx(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === coverIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                      }`}
                      aria-label={t('imageN', { n: idx + 1 })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {coverImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {coverImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setCoverIdx(idx)}
                  className={`relative h-16 w-16 flex-none overflow-hidden rounded-xl border-2 transition-all ${
                    idx === coverIdx
                      ? 'border-purple-600 shadow-md'
                      : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-300'
                  }`}
                >
                  <Image
                    src={img.thumbUrl ?? img.squareUrl ?? img.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Description */}
          {show.description && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6">
              <h2 className="mb-3 text-base font-semibold text-slate-900">{t('aboutEvent')}</h2>
              <p className="whitespace-pre-line text-sm text-slate-600 leading-relaxed">
                {show.description}
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Info + Ticket selection ────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">

            {/* Title + category + share */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {show.category && (
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                      <Tag size={11} />
                      {show.category}
                    </span>
                  )}
                  <h1 className="text-2xl font-bold text-slate-900 leading-tight">{show.name}</h1>
                </div>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-purple-300 hover:text-purple-700 transition-colors"
                  title={t('copyLink')}
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Share2 size={13} />}
                  {copied ? t('copied') : t('share')}
                </button>
              </div>
            </div>

            {/* Termin selector (multiple termins) */}
            {show.termins.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('selectDate')}</p>
                <div className="space-y-2">
                  {show.termins.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTermin(t); setQuantities({}); }}
                      className={`w-full rounded-xl border p-3 text-left text-sm transition-all ${
                        selectedTermin?.id === t.id
                          ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-200'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <Calendar size={13} className="text-purple-500" />
                        {format.dateTime(new Date(t.startsAt), {
                          timeZone: t.timezone,
                          weekday: 'short', day: 'numeric', month: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={11} />
                        {t.venue.name}{t.venue.city ? `, ${t.venue.city}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Single termin info box */}
            {selectedTermin && show.termins.length === 1 && (
              <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Calendar size={15} className="flex-shrink-0 text-purple-500" />
                  <span>{format.dateTime(new Date(selectedTermin.startsAt), {
                    timeZone: selectedTermin.timezone,
                    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}</span>
                </div>
                {selectedTermin.doorsOpenAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock size={13} className="flex-shrink-0" />
                    <span>{t('doors')}:{' '}
                      {format.dateTime(new Date(selectedTermin.doorsOpenAt), {
                        timeZone: selectedTermin.timezone,
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <MapPin size={15} className="flex-shrink-0 text-purple-500" />
                  <span>
                    {selectedTermin.venue.name}
                    {selectedTermin.venue.city ? `, ${selectedTermin.venue.city}` : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Ticket types */}
            {selectedTermin && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('tickets')}</p>
                <div className="space-y-2">
                  {(() => {
                    const now = new Date();
                    // Úloha 22 SEATMAP: SECTIONED = stepper (3a), SEATED = výber sedadiel na plániku (3b).
                    if (selectedTermin.mode === 'SEATMAP') {
                      const terminNotOnSale = selectedTermin.status !== 'ON_SALE';
                      return selectedTermin.sections.map((s) => {
                        // SEATED sekcia – picker
                        if (s.sectionMode === 'SEATED') {
                          const seatSection = seatData.find((d) => d.id === s.id);
                          const selCount = selectedSeats[s.id]?.size ?? 0;
                          const isOpen = openPicker === s.id;
                          return (
                            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                                  <p className="text-base font-bold text-purple-700 mt-0.5">{format.number(s.price, { style: 'currency', currency: s.currency })} / {t('perSeat')}</p>
                                  {selCount > 0 && <p className="mt-1 text-xs text-emerald-600">{t('seatsSelected', { count: selCount })}</p>}
                                </div>
                                {!terminNotOnSale && seatSection && (
                                  <button
                                    onClick={() => setOpenPicker(isOpen ? null : s.id)}
                                    className="flex-shrink-0 rounded-lg border border-purple-300 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                                  >
                                    {isOpen ? t('hideMap') : t('selectSeats')}
                                  </button>
                                )}
                                {terminNotOnSale && <p className="mt-1 text-xs text-blue-500">{t('comingSoon')}</p>}
                              </div>
                              {isOpen && seatSection && (
                                <div className="mt-3">
                                  <SeatPicker
                                    section={seatSection}
                                    selected={selectedSeats[s.id] ?? new Set()}
                                    onToggle={(seatId) => toggleSeat(s.id, seatId)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        }
                        // SECTIONED sekcia – stepper (3a)
                        const qty = quantities[s.id] ?? 0;
                        const isSoldOut = s.available === 0;
                        const disabled = isSoldOut || terminNotOnSale;
                        return (
                          <div
                            key={s.id}
                            className={`rounded-xl border bg-white p-3.5 transition-all ${disabled ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                                <p className="text-base font-bold text-purple-700 mt-0.5">{format.number(s.price, { style: 'currency', currency: s.currency })}</p>
                                {isSoldOut && (
                                  <p className="mt-1 flex items-center gap-1 text-xs text-red-500"><AlertCircle size={11} /> {t('soldOut')}</p>
                                )}
                                {!isSoldOut && terminNotOnSale && (
                                  <p className="mt-1 text-xs text-blue-500">{t('comingSoon')}</p>
                                )}
                                {!disabled && s.available != null && s.available > 0 && s.available <= 10 && (
                                  <p className="mt-1 flex items-center gap-1 text-xs text-orange-500"><AlertCircle size={11} /> {t('lastN', { n: s.available })}</p>
                                )}
                              </div>
                              {!disabled && (
                                <div className="flex flex-shrink-0 items-center gap-2">
                                  <button
                                    onClick={() => adjustQty(s.id, -1, s.available ?? 50)}
                                    disabled={qty === 0}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                                  >
                                    <Minus size={13} />
                                  </button>
                                  <span className="w-5 text-center text-sm font-bold text-slate-900">{qty}</span>
                                  <button
                                    onClick={() => adjustQty(s.id, +1, s.available ?? 50)}
                                    disabled={s.available != null && qty >= s.available}
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-700 text-white hover:bg-purple-600 disabled:opacity-30 transition-colors"
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    }
                    return selectedTermin.ticketTypes.map((tt) => {
                      const qty            = quantities[tt.id] ?? 0;
                      const isSoldOut      = tt.available === 0;
                      const terminNotOnSale = selectedTermin.status !== 'ON_SALE';
                      const saleNotStarted = !!tt.saleStartsAt && new Date(tt.saleStartsAt) > now;
                      const saleEnded      = !!tt.saleEndsAt && new Date(tt.saleEndsAt) <= now;
                      const disabled       = isSoldOut || terminNotOnSale || saleNotStarted || saleEnded;

                      return (
                        <div
                          key={tt.id}
                          className={`rounded-xl border bg-white p-3.5 transition-all ${
                            disabled ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-sm">{tt.name}</p>
                              <p className="text-base font-bold text-purple-700 mt-0.5">
                                {format.number(tt.price, { style: 'currency', currency: tt.currency })}
                              </p>
                              {tt.description && (
                                <p className="mt-0.5 text-xs text-slate-400">{tt.description}</p>
                              )}

                              {/* Status messages */}
                              {isSoldOut && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                                  <AlertCircle size={11} /> {t('soldOut')}
                                </p>
                              )}
                              {!isSoldOut && saleEnded && (
                                <p className="mt-1 text-xs text-slate-400">{t('saleEnded')}</p>
                              )}
                              {!isSoldOut && !saleEnded && (terminNotOnSale || saleNotStarted) && (
                                <p className="mt-1 text-xs text-blue-500">{t('comingSoon')}</p>
                              )}
                              {!disabled && tt.available != null && tt.available > 0 && tt.available <= 10 && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-orange-500">
                                  <AlertCircle size={11} /> {t('lastN', { n: tt.available })}
                                </p>
                              )}
                            </div>

                            {/* QR rýchly nákup (zákazník) + množstvo */}
                            <div className="flex flex-shrink-0 items-center gap-2">
                              {tt.qrPaymentEnabled && selectedTermin.mode === 'GENERAL' && !isSoldOut && (
                                <QrTicketShare ticketTypeId={tt.id} ticketTypeName={tt.name} showName={show.name} />
                              )}
                              {!disabled && (
                                <>
                                  <button
                                    onClick={() => adjustQty(tt.id, -1, tt.maxPerOrder)}
                                    disabled={qty === 0}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                                  >
                                    <Minus size={13} />
                                  </button>
                                  <span className="w-5 text-center text-sm font-bold text-slate-900">
                                    {qty}
                                  </span>
                                  <button
                                    onClick={() => adjustQty(tt.id, +1, tt.maxPerOrder)}
                                    disabled={
                                      qty >= tt.maxPerOrder ||
                                      (tt.available != null && qty >= tt.available)
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-700 text-white hover:bg-purple-600 disabled:opacity-30 transition-colors"
                                  >
                                    <Plus size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Cart summary + CTA */}
            {canAddToCart() && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="flex items-center justify-between rounded-xl bg-purple-50 px-4 py-3 text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-purple-600" />
                    {t('ticketCount', { count: totalQty })}
                  </span>
                  <span className="font-bold text-slate-900">
                    {format.number(totalPrice, { style: 'currency', currency: totalCurrency })}
                  </span>
                </div>

                {/* CTA button */}
                <button
                  onClick={addToCart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-rose-600 hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <ShoppingCart size={18} />
                  {t('continueToOrder')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
