'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { aiConversationsApi, AiConversationListItem } from '@/lib/api';

export default function AiConversationsPage() {
  const t = useTranslations('admin.aiConv');
  const format = useFormatter();
  const [items, setItems] = useState<AiConversationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [onlyEscalated, setOnlyEscalated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await aiConversationsApi.list(
        { status: status || undefined, channel: channel || undefined, escalated: onlyEscalated ? 'true' : undefined, page },
        token,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, channel, onlyEscalated, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, channel, onlyEscalated]);

  const pages = Math.max(1, Math.ceil(total / 30));

  const selectCls = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-coral focus:outline-none';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      {/* Filtre */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="">{t('allStatuses')}</option>
          <option value="OPEN">{t('statusOpen')}</option>
          <option value="CLOSED">{t('statusClosed')}</option>
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectCls}>
          <option value="">{t('allChannels')}</option>
          <option value="GUEST">{t('channelGuest')}</option>
          <option value="CUSTOMER">{t('channelCustomer')}</option>
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={onlyEscalated} onChange={(e) => setOnlyEscalated(e.target.checked)} className="accent-coral" />
          {t('onlyEscalated')}
        </label>
      </div>

      {/* Tabuľka */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">{t('colChannel')}</th>
              <th className="px-4 py-3 font-medium">{t('colStatus')}</th>
              <th className="px-4 py-3 font-medium">{t('colSummary')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('colMessages')}</th>
              <th className="px-4 py-3 font-medium">{t('colTime')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{t('loading')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{t('empty')}</td></tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="hover:bg-cream/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/ai-conversations/${c.id}`} className="block">
                      <span className="font-medium text-slate-800">
                        {c.channel === 'CUSTOMER' ? t('channelCustomer') : t('channelGuest')}
                      </span>
                      {c.email && <span className="block text-xs text-slate-400">{c.email}</span>}
                      <span className="text-[10px] uppercase text-slate-300">{c.locale}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === 'OPEN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.status === 'OPEN' ? t('statusOpen') : t('statusClosed')}
                    </span>
                    {c.escalated && (
                      <span className="ml-1 rounded-full bg-amber/20 px-2 py-0.5 text-xs font-semibold text-amber-700" title={t('escalated')}>⚠️</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <Link href={`/admin/ai-conversations/${c.id}`} className="line-clamp-2 text-slate-600 hover:text-coral">
                      {c.summary ?? <span className="text-slate-300">—</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{c.messageCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    {format.dateTime(new Date(c.lastMessageAt), { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stránkovanie */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">‹</button>
          <span className="text-slate-500">{page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">›</button>
        </div>
      )}
    </div>
  );
}
