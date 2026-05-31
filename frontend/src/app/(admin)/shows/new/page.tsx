'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { showsApi, CreateShowBody } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function NewShowPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateShowBody>({
    name: '', slug: '', description: '', category: '', seoTitle: '', seoDescription: '',
  });
  const [slugManual, setSlugManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, ...(!slugManual ? { slug: toSlug(name) } : {}) }));
  }

  function handleSlugChange(e: ChangeEvent<HTMLInputElement>) {
    setSlugManual(true);
    setForm((f) => ({ ...f, slug: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const show = await showsApi.create(form, token);
      router.push(`/shows/${show.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa vytvoriť podujatie');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard"><img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" /></Link>
        <Link href="/shows" className="text-sm text-brand hover:underline">← Späť na podujatia</Link>
      </header>

      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold mb-6">Nové podujatie</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <Input
            id="name" label="Názov podujatia *" required
            value={form.name} onChange={handleNameChange}
            placeholder="napr. Silvestrovský koncert 2025"
          />
          <Input
            id="slug" label="URL slug *" required
            value={form.slug} onChange={handleSlugChange}
            placeholder="silvestrovsky-koncert-2025"
          />
          <Input
            id="category" label="Kategória"
            value={form.category ?? ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="napr. Hudba, Divadlo, Šport..."
          />
          <Textarea
            id="description" label="Popis"
            value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Stručný popis podujatia..."
            rows={4}
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
            <Button type="button" variant="outline" onClick={() => router.push('/shows')}>Zrušiť</Button>
            <Button type="submit" loading={loading}>Vytvoriť podujatie</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
