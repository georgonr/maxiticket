'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Archive } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getValidToken } from '@/lib/auth';
import { showsApi, Show, ShowImage } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function ShowsPage() {
  const t = useTranslations('organizer.shows');
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try {
        const data = await showsApi.list(token);
        setShows(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function toggleStatus(id: string, next: 'PUBLISHED' | 'DRAFT') {
    const prev = shows.find((s) => s.id === id)?.status ?? 'DRAFT';
    setTogglingId(id);
    setShows((cur) => cur.map((s) => s.id === id ? { ...s, status: next } : s));
    try {
      const token = await getValidToken();
      if (!token) return;
      await showsApi.updateStatus(id, next, token);
      setToast({
        msg: next === 'PUBLISHED'
          ? t('toastPublished')
          : t('toastHidden'),
        ok: true,
      });
    } catch {
      setShows((cur) => cur.map((s) => s.id === id ? { ...s, status: prev } : s));
      setToast({ msg: t('toastStatusError'), ok: false });
    } finally {
      setTogglingId(null);
    }
  }

  const renderCard = (show: Show) => {
    const cover = show.images?.find((i: ShowImage) => i.isCover);
    const isDraft = show.status === 'DRAFT';
    const isArchived = show.status === 'ARCHIVED';
    const isCancelled = show.status === 'CANCELLED';
    const coverOpacity = isCancelled || isArchived ? 'opacity-40' : isDraft ? 'opacity-60' : '';
    return (
      <div key={show.id} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        {/* Cover */}
        <div className={`relative ${coverOpacity}`}>
          {cover ? (
            <img src={cover.squareUrl} alt={show.name} className="w-full h-40 object-cover" />
          ) : (
            <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">{t('noImage')}</div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`font-semibold leading-tight ${isCancelled ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{show.name}</h3>
            {/* Status toggle button (skryté pre zrušené) */}
            {!isCancelled && (isArchived ? (
              <button title={t('statusArchived')} disabled className="flex-shrink-0 rounded p-1 text-slate-400 cursor-not-allowed">
                <Archive size={16} />
              </button>
            ) : show.status === 'PUBLISHED' ? (
              <button
                title={t('actionHide')}
                disabled={togglingId === show.id}
                onClick={() => toggleStatus(show.id, 'DRAFT')}
                className="flex-shrink-0 rounded p-1 text-green-600 hover:text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                <Eye size={16} />
              </button>
            ) : (
              <button
                title={t('actionPublish')}
                disabled={togglingId === show.id}
                onClick={() => toggleStatus(show.id, 'PUBLISHED')}
                className="flex-shrink-0 rounded p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <EyeOff size={16} />
              </button>
            ))}
          </div>

          {/* Status badge */}
          {isCancelled && (
            <span className="inline-block mb-2 rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600">
              {t('badgeCancelled')}
            </span>
          )}
          {isDraft && (
            <span className="inline-block mb-2 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-600">
              {t('badgeDraft')}
            </span>
          )}
          {isArchived && (
            <span className="inline-block mb-2 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
              {t('statusArchived')}
            </span>
          )}
          {/* Skončené: posledný termín skončil >5 h → skryté z verejného zoznamu, ale spravovateľné */}
          {show.isPast && !isArchived && !isCancelled && (
            <span className="inline-block mb-2 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-600" title={t('badgePastHint')}>
              {t('badgePast')}
            </span>
          )}

          {show.category && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{show.category}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => router.push(`/organizer/shows/${show.id}`)}
          >
            {t('manage')}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg transition-all ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <main className="mx-auto max-w-5xl p-8">
        <Link href="/organizer/dashboard" className="inline-block text-sm text-brand hover:underline">← Dashboard</Link>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <Button onClick={() => router.push('/organizer/shows/new')}>{t('newShow')}</Button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {shows.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">{t('emptyTitle')}</p>
            <Button onClick={() => router.push('/organizer/shows/new')}>{t('createFirst')}</Button>
          </div>
        ) : (
          <>
            {/* Aktívne podujatia */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shows.filter((s) => s.status !== 'CANCELLED').map(renderCard)}
            </div>

            {/* Zrušené podujatia – samostatná sekcia dole */}
            {shows.some((s) => s.status === 'CANCELLED') && (
              <div className="mt-10">
                <h2 className="mb-3 text-lg font-semibold text-gray-500 dark:text-gray-400">{t('cancelledSection')}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shows.filter((s) => s.status === 'CANCELLED').map(renderCard)}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
