'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { ticketTypesApi, TicketType, CreateTicketTypeBody } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMPTY_FORM: CreateTicketTypeBody = {
  name: '', price: 0, currency: 'EUR',
  totalQuantity: undefined, maxPerOrder: 10,
  saleStartsAt: '', saleEndsAt: '', isActive: true,
};

export default function TicketTypesPage() {
  const router = useRouter();
  const { id, terminId } = useParams<{ id: string; terminId: string }>();
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateTicketTypeBody>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  async function load(token: string) {
    const data = await ticketTypesApi.list(terminId, token);
    setTicketTypes(data);
  }

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try {
        await load(token);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chyba pri načítaní');
      } finally {
        setLoading(false);
      }
    });
  }, [terminId, router]);

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
      await load(token);
      setForm({ ...EMPTY_FORM });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa vytvoriť typ lístka');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ttId: string) {
    if (!confirm('Naozaj chcete odstrániť tento typ lístka?')) return;
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await ticketTypesApi.delete(terminId, ttId, token);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri mazaní');
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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg text-brand">Maxiticket</Link>
        <Link href={`/shows/${id}`} className="text-sm text-brand hover:underline">← Späť na podujatie</Link>
      </header>

      <main className="mx-auto max-w-2xl p-8 space-y-6">
        <h1 className="text-2xl font-bold">Typy lístkov</h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Existing ticket types */}
        {ticketTypes.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {ticketTypes.map((tt) => (
              <div key={tt.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div>
                  <p className="font-medium text-sm">{tt.name}</p>
                  <p className="text-xs text-gray-500">
                    {tt.price} {tt.currency}
                    {tt.totalQuantity ? ` · ${tt.totalQuantity} ks` : ''}
                    {` · max ${tt.maxPerOrder}/objednávka`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tt.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {tt.isActive ? 'Aktívny' : 'Neaktívny'}
                  </span>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(tt.id)}>
                    Odstrániť
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {ticketTypes.length === 0 && (
          <p className="text-sm text-gray-500">Žiadne typy lístkov.</p>
        )}

        {/* Add form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
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
            <Input
              id="saleStartsAt" label="Predaj od (voliteľné)" type="datetime-local"
              value={form.saleStartsAt ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, saleStartsAt: e.target.value }))}
            />
            <Input
              id="saleEndsAt" label="Predaj do (voliteľné)" type="datetime-local"
              value={form.saleEndsAt ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, saleEndsAt: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive ?? true}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-gray-300 text-brand focus:ring-brand"
              />
              Aktívny (dostupný na predaj)
            </label>
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving}>Pridať typ lístka</Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
