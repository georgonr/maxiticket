'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { aiConversationsApi, AiConversationDetail } from '@/lib/api';

export default function AiConversationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const t = useTranslations('admin.aiConv');
  const format = useFormatter();
  const [conv, setConv] = useState<AiConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getValidToken();
        if (!token) return;
        setConv(await aiConversationsApi.get(id, token));
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-10 text-slate-400">{t('loading')}</div>;
  if (notFound || !conv) return <div className="mx-auto max-w-3xl px-4 py-10 text-slate-500">{t('empty')}</div>;

  const who = conv.channel === 'CUSTOMER' ? t('channelCustomer') : t('channelGuest');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/admin/ai-conversations" className="text-sm font-medium text-coral hover:text-coral-dark">← {t('backToList')}</Link>

      {/* Hlavička */}
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-slate-900">{who}</h1>
          {conv.email && <span className="text-sm text-slate-500">{conv.email}</span>}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${conv.status === 'OPEN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
            {conv.status === 'OPEN' ? t('statusOpen') : t('statusClosed')}
          </span>
          {conv.escalated && <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs font-semibold text-amber-700">⚠️ {t('escalated')}</span>}
          <span className="text-[11px] uppercase text-slate-300">{conv.locale}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {t('colTime')}: {format.dateTime(new Date(conv.createdAt), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          {' · '}{t('colMessages')}: {conv.messages.length}
        </p>
        {conv.summary && (
          <div className="mt-3 rounded-xl bg-coral/5 border border-coral/20 p-3 text-sm text-plum">
            <span className="font-semibold">{t('summary')}: </span>{conv.summary}
          </div>
        )}
      </div>

      {/* Prepis správ */}
      <div className="mt-4 space-y-3">
        {conv.messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'bg-coral text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                {m.role === 'user' ? t('roleUser') : t('roleAssistant')}
              </p>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
