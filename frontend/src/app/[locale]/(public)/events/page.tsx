import { listShowsSSR, getFilterCitiesSSR } from '@/lib/events.server';
import { EventsClient } from './EventsClient';

/**
 * Krok 50 (V5): katalóg podujatí – počiatočný zoznam sa načíta NA SERVERI (SSR)
 * podľa URL filtrov, takže úvodné HTML nie je prázdne (SEO + odolné voči ad-blockeru).
 * Filtre/search/kalendár ostávajú klientske. `searchParams` robí route dynamickým
 * (vždy čerstvé dáta pri načítaní).
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; city?: string; date?: string };
}) {
  const filters = {
    q: searchParams.q ?? '',
    category: searchParams.category ?? '',
    city: searchParams.city ?? '',
    date: searchParams.date ?? '',
  };
  const [showsRes, cities] = await Promise.all([
    listShowsSSR({
      q: filters.q || undefined,
      category: filters.category || undefined,
      // katalóg SSR renderuje grid (nie kalendár) → aplikuj dátumový filter
      date: filters.date || undefined,
      city: filters.city || undefined,
    }),
    getFilterCitiesSSR(),
  ]);

  return (
    <EventsClient
      initialShows={showsRes.status === 'ok' ? showsRes.data : []}
      initialLoadError={showsRes.status === 'error'}
      initialCities={cities}
      initial={filters}
    />
  );
}
