'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Archive } from 'lucide-react';
import { useTranslations, useFormatter } from 'next-intl';
import { getValidToken } from '@/lib/auth';
import { showsApi, Show, ShowImage } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function ShowsPage() {
  const t = useTranslations('organizer.shows');
  const format = useFormatter();
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

  /** Zelené „očko" – rovnaká logika ako doteraz (PUBLISHED=Eye→skryť, DRAFT=EyeOff→zverejniť, ARCHIVED=neaktívne, CANCELLED=bez toggle). */
  const renderEye = (show: Show) => {
    if (show.status === 'CANCELLED') return null;
    if (show.status === 'ARCHIVED') {
      return (
        <button title={t('statusArchived')} disabled className="rounded p-1 text-slate-400 cursor-not-allowed">
          <Archive size={18} />
        </button>
      );
    }
    if (show.status === 'PUBLISHED') {
      return (
        <button
          title={t('actionHide')}
          disabled={togglingId === show.id}
          onClick={() => toggleStatus(show.id, 'DRAFT')}
          className="rounded p-1 text-green-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-50"
        >
          <Eye size={18} />
        </button>
      );
    }
    return (
      <button
        title={t('actionPublish')}
        disabled={togglingId === show.id}
        onClick={() => toggleStatus(show.id, 'PUBLISHED')}
        className="rounded p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors disabled:opacity-50"
      >
        <EyeOff size={18} />
      </button>
    );
  };

  /** Dátum najbližšieho termínu; null → „Bez termínu"; minulý → decentne šedý. */
  const renderNext = (show: Show) => {
    if (!show.nextTerminAt) {
      return <span className="text-gray-400 dark:text-gray-500">{t('noTermin')}</span>;
    }
    const ms = new Date(show.nextTerminAt).getTime();
    const label = format.dateTime(new Date(show.nextTerminAt), { dateStyle: 'medium', timeStyle: 'short' });
    const isPastDate = ms < Date.now();
    return (
      <span className={isPastDate ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}>
        {label}
      </span>
    );
  };

  const statusBadge = (show: Show) => {
    if (show.status === 'DRAFT') {
      return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:bg-amber-500/10">{t('badgeDraft')}</span>;
    }
    if (show.status === 'ARCHIVED') {
      return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">{t('statusArchived')}</span>;
    }
    if (show.status !== 'CANCELLED' && show.isPast) {
      return <span title={t('badgePastHint')} className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600 dark:bg-orange-500/10">{t('badgePast')}</span>;
    }
    return null;
  };

  const renderRow = (show: Show) => {
    const cover = show.images?.find((i: ShowImage) => i.isCover);
    const isCancelled = show.status === 'CANCELLED';
    return (
      <tr key={show.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
        {/* Podujatie: cover (od sm) + názov + badge + dátum (mobil) */}
        <td className="py-3 pr-3">
          <div className="flex items-center gap-3">
            {cover ? (
              <img src={cover.squareUrl} alt="" className="hidden sm:block h-10 w-10 flex-shrink-0 rounded-md object-cover border border-gray-200 dark:border-gray-800" />
            ) : (
              <div className="hidden sm:block h-10 w-10 flex-shrink-0 rounded-md bg-gray-100 dark:bg-gray-800" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  onClick={() => router.push(`/organizer/shows/${show.id}`)}
                  className={`truncate text-left font-medium hover:underline ${isCancelled ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}
                >
                  {show.name}
                </button>
                {statusBadge(show)}
              </div>
              {/* Dátum na mobile (stĺpec „Najbližší termín" je skrytý pod sm) */}
              <div className="mt-0.5 text-xs sm:hidden">{renderNext(show)}</div>
            </div>
          </div>
        </td>

        {/* Najbližší termín (desktop) */}
        <td className="hidden px-3 text-sm sm:table-cell whitespace-nowrap">{renderNext(show)}</td>

        {/* Zelené očko */}
        <td className="px-3 text-center">
          <div className="flex justify-center">{renderEye(show)}</div>
        </td>

        {/* Spravovať */}
        <td className="py-3 pl-3 text-right">
          <Button variant="outline" size="sm" onClick={() => router.push(`/organizer/shows/${show.id}`)}>
            {t('manage')}
          </Button>
        </td>
      </tr>
    );
  };

  const renderTable = (rows: Show[]) => (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
            <th className="py-2.5 pl-4 pr-3 font-medium">{t('colEvent')}</th>
            <th className="hidden px-3 py-2.5 font-medium sm:table-cell">{t('colNext')}</th>
            <th className="px-3 py-2.5 text-center font-medium">{t('colVisible')}</th>
            <th className="py-2.5 pl-3 pr-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/70 [&_td:first-child]:pl-4 [&_td:last-child]:pr-4">
          {rows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  const active = shows.filter((s) => s.status !== 'CANCELLED');
  const cancelled = shows.filter((s) => s.status === 'CANCELLED');

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
            {/* Aktívne podujatia – zoradené backendom podľa najbližšieho termínu */}
            {active.length > 0 && renderTable(active)}

            {/* Zrušené podujatia – samostatná sekcia dole */}
            {cancelled.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-3 text-lg font-semibold text-gray-500 dark:text-gray-400">{t('cancelledSection')}</h2>
                {renderTable(cancelled)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
