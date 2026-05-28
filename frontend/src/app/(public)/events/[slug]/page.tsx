'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { publicApi, PublicShowDetail, PublicTerminDetail } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/format';
import { setCart, Cart } from '@/lib/cart';
import { Calendar, MapPin, Clock, Loader2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EventDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const router = useRouter();
  const [show, setShow] = useState<PublicShowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTermin, setSelectedTermin] = useState<PublicTerminDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [coverIdx, setCoverIdx] = useState(0);

  useEffect(() => {
    publicApi.getShow(slug)
      .then((s) => {
        setShow(s);
        if (s.termins.length > 0) setSelectedTermin(s.termins[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  function adjustQty(ttId: string, delta: number, max: number) {
    setQuantities((prev) => {
      const cur = prev[ttId] ?? 0;
      const next = Math.max(0, Math.min(cur + delta, max));
      return { ...prev, [ttId]: next };
    });
  }

  function canAddToCart() {
    return Object.values(quantities).some((q) => q > 0);
  }

  function addToCart() {
    if (!selectedTermin || !show || !canAddToCart()) return;
    const items = selectedTermin.ticketTypes
      .filter((tt) => (quantities[tt.id] ?? 0) > 0)
      .map((tt) => ({
        ticketTypeId: tt.id,
        quantity: quantities[tt.id],
        name: tt.name,
        price: tt.price,
        currency: tt.currency,
      }));

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!show) {
    return <div className="py-20 text-center text-gray-500">Podujatie nenájdené.</div>;
  }

  const coverImages = show.images.filter((i) => i.squareUrl || i.url);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Left: Images */}
      <div className="lg:col-span-2">
        {/* Main image */}
        <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100">
          {coverImages.length > 0 ? (
            <Image
              src={coverImages[coverIdx].url ?? coverImages[coverIdx].squareUrl}
              alt={show.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <span className="text-6xl font-bold">{show.name.charAt(0)}</span>
            </div>
          )}
        </div>

        {/* Gallery thumbnails */}
        {coverImages.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {coverImages.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setCoverIdx(idx)}
                className={`relative h-16 w-16 flex-none overflow-hidden rounded-lg border-2 transition-all ${
                  idx === coverIdx ? 'border-indigo-600' : 'border-transparent'
                }`}
              >
                <Image src={img.thumbUrl ?? img.squareUrl} alt="" fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>
        )}

        {/* Description */}
        {show.description && (
          <div className="mt-6">
            <h2 className="mb-2 font-semibold text-gray-900">O podujatí</h2>
            <p className="whitespace-pre-line text-gray-600 leading-relaxed">{show.description}</p>
          </div>
        )}
      </div>

      {/* Right: Info + Ticket Selection */}
      <div className="lg:col-span-1">
        <div className="sticky top-20 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{show.name}</h1>
            {show.category && (
              <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {show.category}
              </span>
            )}
          </div>

          {/* Termin selector */}
          {show.termins.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Vyberte termín</label>
              <div className="space-y-2">
                {show.termins.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTermin(t); setQuantities({}); }}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-all ${
                      selectedTermin?.id === t.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar size={13} />{formatDate(t.startsAt, t.timezone, { weekday: 'short', year: undefined, hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex items-center gap-1 mt-0.5 text-gray-500">
                      <MapPin size={12} />{t.venue.name}{t.venue.city ? `, ${t.venue.city}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedTermin && (
            <>
              {/* Single termin info */}
              {show.termins.length === 1 && (
                <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  <p className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {formatDate(selectedTermin.startsAt, selectedTermin.timezone)}
                  </p>
                  {selectedTermin.doorsOpenAt && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock size={12} />
                      Dvere: {formatDate(selectedTermin.doorsOpenAt, selectedTermin.timezone, { weekday: undefined, year: undefined, month: undefined, day: undefined })}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    {selectedTermin.venue.name}{selectedTermin.venue.city ? `, ${selectedTermin.venue.city}` : ''}
                  </p>
                </div>
              )}

              {/* Ticket types */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Vstupenky</label>
                <div className="space-y-2">
                  {selectedTermin.ticketTypes.map((tt) => {
                    const qty = quantities[tt.id] ?? 0;
                    const isSoldOut = tt.available === 0;
                    const isNotOnSale = selectedTermin.status !== 'ON_SALE';
                    const disabled = isSoldOut || isNotOnSale;

                    return (
                      <div key={tt.id} className={`rounded-lg border p-3 ${disabled ? 'opacity-60' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{tt.name}</p>
                            <p className="text-sm font-semibold text-indigo-600">{formatPrice(tt.price, tt.currency)}</p>
                            {tt.description && <p className="text-xs text-gray-400 mt-0.5">{tt.description}</p>}
                            {isSoldOut && <p className="text-xs text-red-500 mt-0.5">Vypredané</p>}
                            {isNotOnSale && !isSoldOut && <p className="text-xs text-blue-500 mt-0.5">Čoskoro v predaji</p>}
                            {tt.available != null && tt.available > 0 && tt.available <= 10 && (
                              <p className="text-xs text-orange-500 mt-0.5">Posledné {tt.available} ks</p>
                            )}
                          </div>
                          {!disabled && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => adjustQty(tt.id, -1, tt.maxPerOrder)}
                                disabled={qty === 0}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                              <button
                                onClick={() => adjustQty(tt.id, +1, tt.maxPerOrder)}
                                disabled={qty >= tt.maxPerOrder || (tt.available != null && qty >= tt.available)}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-30"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {canAddToCart() && (
                <Button onClick={addToCart} className="w-full gap-2" size="lg">
                  <ShoppingCart size={16} /> Pokračovať k objednávke
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
