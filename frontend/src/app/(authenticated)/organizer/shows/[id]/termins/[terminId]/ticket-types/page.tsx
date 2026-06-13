'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { ticketTypesApi, terminsApi, TicketType, CreateTicketTypeBody, TerminSectionRow } from '@/lib/api';
import { seatmapsApi, SeatMapSummary } from '@/lib/api/seatmaps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-time-picker';

const EMPTY_FORM: CreateTicketTypeBody = {
  name: '', price: 0, currency: 'EUR',
  totalQuantity: undefined, maxPerOrder: 10,
  saleStartsAt: '', saleEndsAt: '', isActive: true,
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalDT(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nowDT() { return toLocalDT(new Date().toISOString()); }

function getSaleBadge(tt: TicketType) {
  if (!tt.isActive) return { label: 'Neaktívny', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' };
  const now = new Date();
  if (tt.saleEndsAt && new Date(tt.saleEndsAt) <= now) return { label: 'Predaj ukončený', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' };
  if (tt.saleStartsAt && new Date(tt.saleStartsAt) > now) return { label: 'Čoskoro v predaji', cls: 'bg-blue-100 text-blue-700' };
  return { label: 'V predaji', cls: 'bg-green-100 text-green-700' };
}

export default function TicketTypesPage() {
  const router = useRouter();
  const { id, terminId } = useParams<{ id: string; terminId: string }>();
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateTicketTypeBody>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [startSaleNow, setStartSaleNow] = useState(false);
  const [terminStartsAt, setTerminStartsAt] = useState('');

  // Úloha 22/3a: režim predaja (GENERAL/SEATMAP) + sekcie
  const [mode, setMode] = useState<'GENERAL' | 'SEATMAP'>('GENERAL');
  const [venueId, setVenueId] = useState('');
  const [seatMapId, setSeatMapId] = useState<string | null>(null);
  const [seatMaps, setSeatMaps] = useState<SeatMapSummary[]>([]);
  const [sections, setSections] = useState<TerminSectionRow[]>([]);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [modeSaving, setModeSaving] = useState(false);

  async function loadTicketTypes(token: string) {
    const data = await ticketTypesApi.list(terminId, token);
    setTicketTypes(data);
  }

  async function loadSections(token: string) {
    const res = await terminsApi.listSections(id, terminId, token);
    setSections(res.sections);
    setPriceDraft(Object.fromEntries(res.sections.map((s) => [s.id, String(s.price)])));
  }

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try {
        const [, termin] = await Promise.all([
          loadTicketTypes(token),
          terminsApi.get(id, terminId, token),
        ]);
        setTerminStartsAt(termin.startsAt);
        setVenueId(termin.venueId);
        setMode(termin.mode ?? 'GENERAL');
        setSeatMapId(termin.seatMapId ?? null);
        const maps = await seatmapsApi.list(termin.venueId, token).catch(() => []);
        setSeatMaps(maps);
        if ((termin.mode ?? 'GENERAL') === 'SEATMAP') await loadSections(token);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chyba pri načítaní');
      } finally {
        setLoading(false);
      }
    });
  }, [terminId, id, router]);

  function handleStartSaleNow(checked: boolean) {
    setStartSaleNow(checked);
    if (checked) {
      setForm((f) => ({
        ...f,
        saleStartsAt: nowDT(),
        saleEndsAt: terminStartsAt ? toLocalDT(terminStartsAt) : f.saleEndsAt,
      }));
    }
    // When unchecked: keep values, re-enable inputs
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const body: CreateTicketTypeBody = {
        ...form,
        price: Number(form.price),
        totalQuantity: form.totalQuantity ? Number(form.totalQuantity) : undefined,
        maxPerOrder: Number(form.maxPerOrder) || 10,
        saleStartsAt: form.saleStartsAt || undefined,
        saleEndsAt: form.saleEndsAt || undefined,
      };
      await ticketTypesApi.create(terminId, body, token);
      const token2 = await getValidToken();
      if (token2) await loadTicketTypes(token2);
      setForm({ ...EMPTY_FORM });
      setStartSaleNow(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa vytvoriť typ lístka');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ttId: string) {
    if (!confirm('Naozaj chcete odstrániť tento typ lístka?')) return;
    setError('');
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await ticketTypesApi.delete(terminId, ttId, token);
      const token2 = await getValidToken();
      if (token2) await loadTicketTypes(token2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri mazaní');
    }
  }

  async function handleSwitchMode(nextMode: 'GENERAL' | 'SEATMAP', nextSeatMapId?: string | null) {
    setError('');
    setModeSaving(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const body: { mode: 'GENERAL' | 'SEATMAP'; seatMapId?: string | null } = { mode: nextMode };
      if (nextMode === 'SEATMAP') body.seatMapId = nextSeatMapId ?? seatMapId ?? seatMaps[0]?.id;
      await terminsApi.update(id, terminId, body, token);
      setMode(nextMode);
      setSeatMapId(nextMode === 'SEATMAP' ? (body.seatMapId ?? null) : null);
      const token2 = await getValidToken();
      if (token2 && nextMode === 'SEATMAP') await loadSections(token2);
      else setSections([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepodarilo sa zmeniť režim termínu');
    } finally {
      setModeSaving(false);
    }
  }

  async function handleSavePrice(ts: TerminSectionRow) {
    setError('');
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await terminsApi.setSectionPrice(id, terminId, ts.id, { price: Number(priceDraft[ts.id] ?? 0) }, token);
      const token2 = await getValidToken();
      if (token2) await loadSections(token2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepodarilo sa uložiť cenu');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 flex items-center justify-between">
        <Link href="/organizer/dashboard"><img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" /></Link>
        <Link href={`/organizer/shows/${id}`} className="text-sm text-brand hover:underline">← Späť na podujatie</Link>
      </header>

      <main className="mx-auto max-w-2xl p-8 space-y-6">
        <h1 className="text-2xl font-bold">Predaj na termíne</h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Úloha 22/3a: režim predaja */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <h2 className="font-semibold">Režim predaja</h2>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={modeSaving}
              onClick={() => mode !== 'GENERAL' && handleSwitchMode('GENERAL')}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm text-left ${mode === 'GENERAL' ? 'border-brand bg-brand/5 dark:bg-brand/10' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <span className="font-medium block">Všeobecný (GENERAL)</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Typy lístkov s cenou a počtom</span>
            </button>
            <button
              type="button"
              disabled={modeSaving || seatMaps.length === 0}
              onClick={() => mode !== 'SEATMAP' && handleSwitchMode('SEATMAP')}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm text-left disabled:opacity-50 ${mode === 'SEATMAP' ? 'border-brand bg-brand/5 dark:bg-brand/10' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <span className="font-medium block">Plánik (SEATMAP)</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {seatMaps.length === 0 ? 'Najprv vytvorte plánik pre miesto konania' : 'Predaj po sekciách'}
              </span>
            </button>
          </div>
          {mode === 'SEATMAP' && seatMaps.length > 0 && (
            <div>
              <label className="text-sm font-medium block mb-1">Plánik</label>
              <select
                value={seatMapId ?? ''}
                disabled={modeSaving}
                onChange={(e) => handleSwitchMode('SEATMAP', e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                {seatMaps.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.sectionCount} sekcií)</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Úloha 22/3a: SEATMAP – ceny sekcií */}
        {mode === 'SEATMAP' && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h2 className="font-semibold">Sekcie a ceny</h2>
            {sections.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Plánik nemá žiadne sekcie.</p>
            )}
            {sections.map((ts) => (
              <div key={ts.id} className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-sm">{ts.name}</p>
                  {ts.sellable ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Kapacita {ts.capacity ?? '—'} · predané {ts.sold}
                      {ts.remaining != null ? ` · zostáva ${ts.remaining}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600">Sedadlá – predaj sedadiel pripravujeme (Fáza 3b)</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`price-${ts.id}`} type="number" min={0} step="0.01"
                    className="w-28"
                    value={priceDraft[ts.id] ?? ''}
                    onChange={(e) => setPriceDraft((d) => ({ ...d, [ts.id]: e.target.value }))}
                  />
                  <span className="text-xs text-gray-500">{ts.currency}</span>
                  <Button size="sm" variant="outline" onClick={() => handleSavePrice(ts)}>Uložiť</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GENERAL: typy lístkov */}
        {mode === 'GENERAL' && (<>
        {/* Existing ticket types */}
        {ticketTypes.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {ticketTypes.map((tt) => {
              const badge = getSaleBadge(tt);
              return (
                <div key={tt.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div>
                    <p className="font-medium text-sm">{tt.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tt.price} {tt.currency}
                      {tt.totalQuantity ? ` · ${tt.totalQuantity} ks` : ''}
                      {` · max ${tt.maxPerOrder}/objednávka`}
                    </p>
                    {tt.saleStartsAt && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Predaj od: {new Date(tt.saleStartsAt).toLocaleString('sk-SK')}
                        {tt.saleEndsAt ? ` – ${new Date(tt.saleEndsAt).toLocaleString('sk-SK')}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(tt.id)}>
                      Odstrániť
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {ticketTypes.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Žiadne typy lístkov.</p>
        )}

        {/* Add form */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="font-semibold mb-4">Pridať typ lístka</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="ttName" label="Názov *" required
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="napr. Štandardný lístok"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="price" label="Cena *" type="number" min={0} step="0.01" required
                value={form.price === 0 ? '' : form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                placeholder="9.90"
              />
              <Input
                id="currency" label="Mena"
                value={form.currency ?? 'EUR'}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="totalQty" label="Celkový počet (voliteľné)" type="number" min={1}
                value={form.totalQuantity ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, totalQuantity: e.target.value ? Number(e.target.value) : undefined }))}
              />
              <Input
                id="maxPerOrder" label="Max. na objednávku"
                type="number" min={1}
                value={form.maxPerOrder ?? 10}
                onChange={(e) => setForm((f) => ({ ...f, maxPerOrder: Number(e.target.value) }))}
              />
            </div>

            {/* Start sale now checkbox */}
            <label className="flex items-center gap-2 text-sm cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={startSaleNow}
                onChange={(e) => handleStartSaleNow(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-700 text-brand focus:ring-brand"
              />
              <span className="font-medium text-indigo-800">
                Okamžite začať predaj
                <span className="ml-1 font-normal text-indigo-600">(vyplní „Predaj od" = teraz, „Predaj do" = dátum termínu)</span>
              </span>
            </label>

            <DateTimePicker
              id="saleStartsAt" label="Predaj od (voliteľné)" showQuickButtons
              disabled={startSaleNow}
              value={form.saleStartsAt ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, saleStartsAt: v }))}
            />
            <DateTimePicker
              id="saleEndsAt" label="Predaj do (voliteľné)" showQuickButtons
              disabled={startSaleNow}
              value={form.saleEndsAt ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, saleEndsAt: v }))}
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive ?? true}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-gray-300 dark:border-gray-700 text-brand focus:ring-brand"
              />
              Aktívny (dostupný na predaj)
            </label>
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving}>Pridať typ lístka</Button>
            </div>
          </form>
        </div>
        </>)}
      </main>
    </div>
  );
}
