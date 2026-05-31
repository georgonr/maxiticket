'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { terminsApi, venuesApi, Venue, CreateTerminBody, CreateVenueBody } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DateTimePicker } from '@/components/ui/date-time-picker';

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Bratislava', label: 'Europe/Bratislava' },
  { value: 'Europe/Prague', label: 'Europe/Prague' },
  { value: 'UTC', label: 'UTC' },
];

const STATUS_OPTIONS = [
  { value: 'COMING_SOON', label: 'Čoskoro' },
  { value: 'ON_SALE', label: 'V predaji' },
  { value: 'SOLD_OUT', label: 'Vypredané' },
  { value: 'CANCELLED', label: 'Zrušené' },
];

export default function NewTerminPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [form, setForm] = useState<CreateTerminBody>({
    venueId: '', startsAt: '', endsAt: '', timezone: 'Europe/Bratislava',
    capacity: undefined, status: 'COMING_SOON', visible: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Inline new venue form
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [venueForm, setVenueForm] = useState<CreateVenueBody>({ name: '', city: '' });
  const [creatingVenue, setCreatingVenue] = useState(false);

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try {
        const data = await venuesApi.list(token);
        setVenues(data);
        if (data.length > 0) setForm((f) => ({ ...f, venueId: data[0].id }));
      } catch {
        // venues may be empty
      }
    });
  }, [router]);

  async function handleCreateVenue() {
    setCreatingVenue(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const venue = await venuesApi.create(venueForm, token);
      setVenues((v) => [...v, venue]);
      setForm((f) => ({ ...f, venueId: venue.id }));
      setShowVenueForm(false);
      setVenueForm({ name: '', city: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri vytváraní miesta');
    } finally {
      setCreatingVenue(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.venueId) { setError('Vyberte miesto konania'); return; }
    setError('');
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const body: CreateTerminBody = {
        ...form,
        endsAt: form.endsAt || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      };
      await terminsApi.create(id, body, token);
      router.push(`/shows/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa vytvoriť termín');
      setLoading(false);
    }
  }

  const venueOptions = venues.map((v) => ({ value: v.id, label: `${v.name}${v.city ? ` (${v.city})` : ''}` }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard"><img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" /></Link>
        <Link href={`/shows/${id}`} className="text-sm text-brand hover:underline">← Späť na podujatie</Link>
      </header>

      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold mb-6">Nový termín</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          {/* Venue */}
          <div>
            {venueOptions.length > 0 ? (
              <Select
                id="venueId" label="Miesto konania *"
                value={form.venueId}
                options={venueOptions}
                onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value }))}
              />
            ) : (
              <p className="text-sm text-gray-500">Žiadne miesta. Vytvorte nové miesto nižšie.</p>
            )}
            <button
              type="button"
              onClick={() => setShowVenueForm((v) => !v)}
              className="mt-1 text-xs text-brand hover:underline"
            >
              {showVenueForm ? 'Zrušiť' : '+ Nové miesto'}
            </button>

            {showVenueForm && (
              <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
                <Input
                  id="venueName" label="Názov miesta *" required
                  value={venueForm.name} onChange={(e) => setVenueForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="napr. Mestské divadlo"
                />
                <Input
                  id="venueCity" label="Mesto"
                  value={venueForm.city ?? ''} onChange={(e) => setVenueForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="napr. Bratislava"
                />
                <Button type="button" size="sm" loading={creatingVenue} onClick={handleCreateVenue}>
                  Vytvoriť miesto
                </Button>
              </div>
            )}
          </div>

          <DateTimePicker
            id="startsAt" label="Začiatok *" required showQuickButtons
            value={form.startsAt}
            onChange={(v) => setForm((f) => ({ ...f, startsAt: v }))}
          />
          <DateTimePicker
            id="endsAt" label="Koniec (voliteľné)" showQuickButtons
            value={form.endsAt ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, endsAt: v }))}
          />
          <Select
            id="timezone" label="Časová zóna"
            value={form.timezone ?? 'Europe/Bratislava'}
            options={TIMEZONE_OPTIONS}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          />
          <Input
            id="capacity" label="Kapacita (voliteľné)" type="number" min={1}
            value={form.capacity ?? ''} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value ? Number(e.target.value) : undefined }))}
          />
          <Select
            id="status" label="Stav"
            value={form.status ?? 'COMING_SOON'}
            options={STATUS_OPTIONS}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.visible ?? true}
              onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))}
              className="rounded border-gray-300 text-brand focus:ring-brand"
            />
            Viditeľný pre verejnosť
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.push(`/shows/${id}`)}>Zrušiť</Button>
            <Button type="submit" loading={loading}>Vytvoriť termín</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
