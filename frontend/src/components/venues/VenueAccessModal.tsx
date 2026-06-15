'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Search } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { venuesApi, organizersApi, OrganizerLite, Venue } from '@/lib/api';
import { Button } from '@/components/ui/button';

// Úloha 24: SUPERADMIN sprístupní miesto vybraným organizátorom (multi-select, PUT access).
export function VenueAccessModal({
  venue,
  onClose,
  onSaved,
}: {
  venue: Venue;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const t = useTranslations('organizer.venues');
  const [organizers, setOrganizers] = useState<OrganizerLite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = await getValidToken();
        if (!token) throw new Error(t('access.error.loginRequired'));
        const [orgs, access] = await Promise.all([
          organizersApi.list(token),
          venuesApi.getAccess(venue.id, token),
        ]);
        setOrganizers(orgs);
        setSelected(new Set(access.organizerIds));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('access.error.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [venue.id, t]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error(t('access.error.loginRequired'));
      await venuesApi.setAccess(venue.id, Array.from(selected), token);
      onSaved(t('access.toast.saved', { name: venue.name, count: selected.size }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('access.error.saveFailed'));
      setSaving(false);
    }
  }

  const visible = organizers.filter((o) =>
    !filter.trim() || o.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('access.title')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{venue.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('form.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5">
            <Search size={15} className="text-gray-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('access.searchPlaceholder')}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">{t('access.loading')}</p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{t('access.noOrganizers')}</p>
          ) : (
            <ul className="space-y-1">
              {visible.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                      className="rounded border-gray-300 text-brand focus:ring-brand"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-100">{o.name}</span>
                    <span className="ml-auto text-xs text-gray-400">{o.slug}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
          <span className="text-xs text-gray-500">{t('access.selectedCount', { count: selected.size })}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>{t('form.cancel')}</Button>
            <Button onClick={save} loading={saving} disabled={saving || loading}>{t('form.save')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
