'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { helpdeskApi, type HelpdeskTicketListItem } from '@/lib/api';

const REFRESH_MS = 30_000;

const STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-coral/10 text-coral ring-1 ring-coral/30',
  PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  CLOSED: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};
const PRIORITY_CLS: Record<string, string> = {
  HIGH: 'text-red-600 font-semibold',
  NORMAL: 'text-slate-500',
  LOW: 'text-slate-400',
};

export default function HelpdeskPage() {
  const t = useTranslations('admin.helpdesk');
  const format = useFormatter();
  const [items, setItems] = useState<HelpdeskTicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await helpdeskApi.list({ status: status || undefined, page }, token);
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  // Auto-refresh: nové odpovede chodia z IMAP pollera na pozadí, takže zoznam
  // by inak zostal visieť na stave spred otvorenia stránky.
  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 30));
  const selectCls =
    'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-coral focus:outline-none';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="">{t('allStatuses')}</option>
          <option value="OPEN">{t('status.OPEN')}</option>
          <option value="PENDING">{t('status.PENDING')}</option>
          <option value="CLOSED">{t('status.CLOSED')}</option>
        </select>
        <span className="text-sm text-slate-400">{t('count', { total })}</span>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">{t('loading')}</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/admin/helpdesk/${it.id}`}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 ${
                    it.status === 'OPEN' ? 'border-l-2 border-coral' : 'border-l-2 border-transparent'
                  }`}
                >
                  <span className="font-mono text-xs text-slate-400">{it.ticketNumber}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {it.subject || t('noSubject')}
                  </span>
                  <span className="truncate text-xs text-slate-500">{it.customerEmail}</span>
                  <span className={`text-xs ${PRIORITY_CLS[it.priority]}`}>
                    {t(`priority.${it.priority}`)}
                  </span>
                  <span className="text-xs text-slate-400">{t('messages', { n: it.messageCount })}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[it.status]}`}>
                    {t(`status.${it.status}`)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {format.dateTime(new Date(it.lastMessageAt ?? it.updatedAt), {
                      day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {t('prev')}
          </button>
          <span className="text-sm text-slate-500">{t('pageOf', { page, pages })}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {t('next')}
          </button>
        </div>
      )}
    </div>
  );
}
