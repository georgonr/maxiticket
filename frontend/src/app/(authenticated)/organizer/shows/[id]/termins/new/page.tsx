'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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

export default function NewTerminPage() {
  const t = useTranslations('organizer.termin');
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const STATUS_OPTIONS = [
    { value: 'COMING_SOON', label: t('statusComingSoon') },
    { value: 'ON_SALE', label: t('statusOnSale') },
    { value: 'SOLD_OUT', label: t('statusSoldOut') },
    { value: 'CANCELLED', label: t('statusCancelled') },
  ];
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
        // Len aktívne miesta (deaktivované sa pri nových termínoch neponúkajú).
        const data = await venuesApi.list(token, { isActive: true });
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
      setError(e instanceof Error ? e.message : t('errorCreateVenue'));
    } finally {
      setCreatingVenue(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.venueId) { setError(t('errorSelectVenue')); return; }
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
      // Invaliduj Router Cache detailu, inak sa nový termín zobrazí až po hard reloade.
      router.refresh();
      router.push(`/organizer/shows/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorCreateTermin'));
      setLoading(false);
    }
  }

  const venueOptions = venues.map((v) => ({
    value: v.id,
    label: `${v.name}${v.city ? ` (${v.city})` : ''}${v.organizerId == null ? ` • ${t('venueGlobal')}` : ''}`,
  }));

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 flex items-center justify-between">
        <Link href="/organizer/dashboard"><img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" /></Link>
        <Link href={`/organizer/shows/${id}`} className="text-sm text-brand hover:underline">← {t('backToShow')}</Link>
      </header>

      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold mb-6">{t('newTitle')}</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          {/* Venue */}
          <div>
            {venueOptions.length > 0 ? (
              <Select
                id="venueId" label={t('venueLabel')}
                value={form.venueId}
                options={venueOptions}
                onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value }))}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noVenues')}</p>
            )}
            <button
              type="button"
              onClick={() => setShowVenueForm((v) => !v)}
              className="mt-1 text-xs text-brand hover:underline"
            >
              {showVenueForm ? t('cancel') : t('newVenue')}
            </button>

            {showVenueForm && (
              <div className="mt-2 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3 space-y-2">
                <Input
                  id="venueName" label={t('venueNameLabel')} required
                  value={venueForm.name} onChange={(e) => setVenueForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('venueNamePlaceholder')}
                />
                <Input
                  id="venueCity" label={t('cityLabel')}
                  value={venueForm.city ?? ''} onChange={(e) => setVenueForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder={t('cityPlaceholder')}
                />
                <Button type="button" size="sm" loading={creatingVenue} onClick={handleCreateVenue}>
                  {t('createVenue')}
                </Button>
              </div>
            )}
          </div>

          <DateTimePicker
            id="startsAt" label={t('startLabel')} required showQuickButtons
            value={form.startsAt}
            onChange={(v) => setForm((f) => ({ ...f, startsAt: v }))}
          />
          <DateTimePicker
            id="endsAt" label={t('endLabel')} showQuickButtons
            value={form.endsAt ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, endsAt: v }))}
          />
          <Select
            id="timezone" label={t('timezoneLabel')}
            value={form.timezone ?? 'Europe/Bratislava'}
            options={TIMEZONE_OPTIONS}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          />
          <Input
            id="capacity" label={t('capacityLabel')} type="number" min={1}
            value={form.capacity ?? ''} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value ? Number(e.target.value) : undefined }))}
          />
          <Select
            id="status" label={t('statusLabel')}
            value={form.status ?? 'COMING_SOON'}
            options={STATUS_OPTIONS}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.visible ?? true}
              onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))}
              className="rounded border-gray-300 dark:border-gray-700 text-brand focus:ring-brand"
            />
            {t('visibleToPublic')}
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.push(`/organizer/shows/${id}`)}>{t('cancel')}</Button>
            <Button type="submit" loading={loading}>{t('createTermin')}</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
