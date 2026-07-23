import { notFound } from 'next/navigation';
import { getShowSSR } from '@/lib/events.server';
import { EventDetailClient } from './EventDetailClient';

/**
 * Krok 50 (V5): server komponent – detail podujatia sa načíta NA SERVERI (SSR),
 * takže ceny/typy/dostupnosť sú v úvodnom HTML (SEO + odolné voči ad-blockeru).
 * Interaktivita (výber lístka/sedadla, košík) žije v EventDetailClient.
 *
 * Rozlíšenie stavov (V6): 404 → notFound() (reálny HTTP 404 + not-found.tsx);
 * výpadok načítania → EventDetailClient s loadStatus='error' (hláška, nie prázdno).
 */
export default async function EventDetailPage({ params }: { params: { slug: string } }) {
  const res = await getShowSSR(params.slug);
  if (res.status === 'notfound') notFound(); // reálny 404 – podujatie neexistuje
  return (
    <EventDetailClient
      slug={params.slug}
      initialShow={res.status === 'ok' ? res.data : null}
      loadStatus={res.status}
    />
  );
}
