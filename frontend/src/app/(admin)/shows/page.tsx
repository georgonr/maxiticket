'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { showsApi, Show } from '@/lib/api';
import { Button } from '@/components/ui/button';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-yellow-100 text-yellow-700',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Koncept',
  PUBLISHED: 'Zverejnené',
  ARCHIVED: 'Archivované',
};

export default function ShowsPage() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try {
        const data = await showsApi.list(token);
        setShows(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nepodarilo sa načítať podujatia');
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

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
        <Link href="/dashboard" className="text-sm text-brand hover:underline">← Dashboard</Link>
      </header>

      <main className="mx-auto max-w-5xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Podujatia</h1>
          <Button onClick={() => router.push('/shows/new')}>Nové podujatie</Button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {shows.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-gray-500 mb-4">Zatiaľ nemáte žiadne podujatia.</p>
            <Button onClick={() => router.push('/shows/new')}>Vytvoriť prvé podujatie</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shows.map((show) => (
              <div key={show.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                {show.posterUrl && (
                  <img src={show.posterUrl} alt={show.name} className="w-full h-40 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 leading-tight">{show.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[show.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[show.status] ?? show.status}
                    </span>
                  </div>
                  {show.category && (
                    <p className="text-xs text-gray-500 mb-3">{show.category}</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/shows/${show.id}`)}
                  >
                    Spravovať
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
