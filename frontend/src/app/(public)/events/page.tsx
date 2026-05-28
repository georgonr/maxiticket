'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { publicApi, PublicShow } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/format';
import { Search, Calendar, MapPin, Tag, Loader2 } from 'lucide-react';

const DATE_OPTIONS = [
  { value: '', label: 'Všetky dátumy' },
  { value: 'today', label: 'Dnes' },
  { value: 'week', label: 'Tento týždeň' },
  { value: 'weekend', label: 'Víkend' },
];

export default function EventsPage() {
  const [shows, setShows] = useState<PublicShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [filterCat, setFilterCat] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterCity, setFilterCity] = useState('');

  useEffect(() => {
    publicApi.getFilters().then((f) => {
      setCategories(f.categories);
      setCities(f.cities);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    publicApi
      .listShows({
        category: filterCat || undefined,
        date: filterDate || undefined,
        city: filterCity || undefined,
      })
      .then(setShows)
      .catch(() => setShows([]))
      .finally(() => setLoading(false));
  }, [filterCat, filterDate, filterCity]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Podujatia</h1>
        <p className="mt-1 text-gray-500">Nájdite a kúpte vstupenky na vaše obľúbené podujatia</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Tag size={14} className="text-gray-400" />
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Všetky kategórie</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-gray-400" />
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {cities.length > 0 && (
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-gray-400" />
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Všetky mestá</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : shows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Search size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Žiadne podujatia nenájdené</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShowCard({ show }: { show: PublicShow }) {
  const termin = show.termins[0];

  return (
    <Link href={`/events/${show.slug}`} className="group block rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* Cover */}
      <div className="aspect-square bg-gradient-to-br from-indigo-100 to-purple-100 relative overflow-hidden">
        {show.coverUrl ? (
          <Image
            src={show.coverUrl}
            alt={show.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-indigo-300">
            <span className="text-5xl font-bold opacity-30">{show.name.charAt(0)}</span>
          </div>
        )}
        {show.category && (
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
            {show.category}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h2 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">{show.name}</h2>

        {termin && (
          <>
            <p className="mt-1.5 flex items-center gap-1 text-sm text-gray-500">
              <Calendar size={13} />
              {formatDate(termin.startsAt, termin.timezone, { weekday: undefined, year: undefined })}
            </p>
            {termin.city && (
              <p className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin size={13} /> {termin.venueName}{termin.city !== termin.venueName ? `, ${termin.city}` : ''}
              </p>
            )}
          </>
        )}

        {show.termins.length > 1 && (
          <p className="mt-1 text-xs text-indigo-600">{show.termins.length} termínov</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          {termin?.minPrice != null ? (
            <span className="text-sm font-semibold text-gray-900">
              od {formatPrice(termin.minPrice, termin.currency)}
            </span>
          ) : (
            <span className="text-sm text-gray-400">Cena neuvedená</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            termin?.status === 'ON_SALE'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {termin?.status === 'ON_SALE' ? 'V predaji' : 'Čoskoro'}
          </span>
        </div>
      </div>
    </Link>
  );
}
