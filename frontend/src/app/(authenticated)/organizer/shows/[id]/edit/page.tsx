'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { showsApi, CreateShowBody } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Koncept' },
  { value: 'PUBLISHED', label: 'Zverejnené' },
  { value: 'ARCHIVED', label: 'Archivované' },
];

export default function EditShowPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<CreateShowBody & { status: string }>({
    name: '', slug: '', description: '', category: '', seoTitle: '', seoDescription: '', status: 'DRAFT',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try {
        const show = await showsApi.get(id, token);
        setForm({
          name: show.name,
          slug: show.slug,
          description: show.description ?? '',
          category: show.category ?? '',
          seoTitle: show.seoTitle ?? '',
          seoDescription: show.seoDescription ?? '',
          status: show.status,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chyba pri načítaní');
      } finally {
        setLoading(false);
      }
    });
  }, [id, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      await showsApi.update(id, form, token);
      router.push(`/organizer/shows/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa uložiť zmeny');
      setSaving(false);
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

      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold mb-6">Editovať podujatie</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <Input
            id="name" label="Názov podujatia *" required
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            id="slug" label="URL slug *" required
            value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <Input
            id="category" label="Kategória"
            value={form.category ?? ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <Textarea
            id="description" label="Popis"
            value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
          />
          <Select
            id="status" label="Stav"
            value={form.status}
            options={STATUS_OPTIONS}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          />
          <Input
            id="seoTitle" label="SEO titulok"
            value={form.seoTitle ?? ''} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
          />
          <Textarea
            id="seoDescription" label="SEO popis"
            value={form.seoDescription ?? ''} onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
            rows={2}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.push(`/organizer/shows/${id}`)}>Zrušiť</Button>
            <Button type="submit" loading={saving}>Uložiť zmeny</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
