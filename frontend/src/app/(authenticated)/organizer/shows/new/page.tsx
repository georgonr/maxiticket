'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { showsApi, CreateShowBody } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategorySelect } from '@/components/shows/CategorySelect';
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
  const t = useTranslations('organizer.showForm');
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
      router.push(`/organizer/shows/${show.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorCreate'));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900">
      <main className="mx-auto max-w-2xl p-8">
        <Link href="/organizer/shows" className="inline-block text-sm text-brand hover:underline">{t('backToShows')}</Link>
        <h1 className="text-2xl font-bold mb-6">{t('titleNew')}</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <Input
            id="name" label={t('labelName')} required
            value={form.name} onChange={handleNameChange}
            placeholder={t('placeholderName')}
          />
          <Input
            id="slug" label={t('labelSlug')} required
            value={form.slug} onChange={handleSlugChange}
            placeholder={t('placeholderSlug')}
          />
          <CategorySelect
            label={t('labelCategory')}
            placeholder={t('placeholderCategory')}
            invalidSuffix={t('categoryInvalid')}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          />
          <Textarea
            id="description" label={t('labelDescription')}
            value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t('placeholderDescription')}
            rows={4}
          />
          <Input
            id="seoTitle" label={t('labelSeoTitle')}
            value={form.seoTitle ?? ''} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
          />
          <Textarea
            id="seoDescription" label={t('labelSeoDescription')}
            value={form.seoDescription ?? ''} onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
            rows={2}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.push('/organizer/shows')}>{t('cancel')}</Button>
            <Button type="submit" loading={loading}>{t('createButton')}</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
