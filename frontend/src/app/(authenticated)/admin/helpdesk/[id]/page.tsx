'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Paperclip, Send, Loader2, AlertTriangle } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import {
  helpdeskApi,
  type HelpdeskTicketDetail,
  type HelpdeskMessageItem,
  type HelpdeskStatus,
  type HelpdeskPriority,
} from '@/lib/api';

const SENDER_CLS: Record<string, string> = {
  CUSTOMER: 'border-slate-200 bg-white',
  ADMIN: 'border-coral/30 bg-coral/5',
  AI: 'border-violet-200 bg-violet-50',
};

export default function HelpdeskDetailPage() {
  const t = useTranslations('admin.helpdesk');
  const format = useFormatter();
  const { id } = useParams<{ id: string }>();

  const [ticket, setTicket] = useState<HelpdeskTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  /** null = nič sa nedialo; inak výsledok posledného pokusu o odpoveď. */
  const [result, setResult] = useState<{ emailed: boolean; error?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getValidToken();
      if (!token) return;
      setTicket(await helpdeskApi.detail(id, token));
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function sendReply() {
    if (!reply.trim() || sending) return;
    setSending(true);
    setResult(null);
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await helpdeskApi.reply(id, reply, token);
      // Text mažeme len keď je uložený. Odoslanie mailu je samostatná vec –
      // keď zlyhá, správa je v tikete a admin ju nemá prečo písať znova.
      if (res.messageSaved) setReply('');
      setResult({ emailed: res.emailed, error: res.error });
      await load();
    } catch (e: unknown) {
      setResult({ emailed: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  async function patch(body: { status?: HelpdeskStatus; priority?: HelpdeskPriority }) {
    const token = await getValidToken();
    if (!token) return;
    setTicket(await helpdeskApi.patch(id, body, token));
  }

  if (loading) return <p className="p-8 text-sm text-slate-400">{t('loading')}</p>;
  if (!ticket) return <p className="p-8 text-sm text-slate-400">{t('notFound')}</p>;

  const btn = 'rounded-lg border px-2.5 py-1 text-xs transition-colors';
  const btnOn = 'border-coral bg-coral/10 text-coral';
  const btnOff = 'border-slate-300 text-slate-600 hover:bg-slate-50';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/admin/helpdesk" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-coral">
        <ArrowLeft size={14} /> {t('back')}
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs text-slate-400">{ticket.ticketNumber}</span>
          <h1 className="text-lg font-bold text-slate-900">{ticket.subject || t('noSubject')}</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">{ticket.customerEmail}</p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">{t('statusLabel')}</span>
            {(['OPEN', 'PENDING', 'CLOSED'] as HelpdeskStatus[]).map((s) => (
              <button key={s} onClick={() => patch({ status: s })}
                className={`${btn} ${ticket.status === s ? btnOn : btnOff}`}>
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">{t('priorityLabel')}</span>
            {(['LOW', 'NORMAL', 'HIGH'] as HelpdeskPriority[]).map((p) => (
              <button key={p} onClick={() => patch({ priority: p })}
                className={`${btn} ${ticket.priority === p ? btnOn : btnOff}`}>
                {t(`priority.${p}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {ticket.messages.map((m) => <Message key={m.id} m={m} t={t} format={format} />)}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="reply" className="mb-2 block text-sm font-medium text-slate-700">
          {t('replyLabel')}
        </label>
        <textarea
          id="reply" rows={5} value={reply} onChange={(e) => setReply(e.target.value)}
          placeholder={t('replyPlaceholder')}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-coral focus:outline-none"
        />
        {result && (
          <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            result.emailed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
          }`}>
            {!result.emailed && <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />}
            <span>
              {result.emailed ? t('replySent') : t('replySavedNotSent')}
              {result.error && <span className="block text-xs opacity-70">{result.error}</span>}
            </span>
          </div>
        )}
        <button
          onClick={sendReply} disabled={sending || !reply.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {t('sendReply')}
        </button>
      </div>
    </div>
  );
}

function Message({
  m, t, format,
}: {
  m: HelpdeskMessageItem;
  t: ReturnType<typeof useTranslations>;
  format: ReturnType<typeof useFormatter>;
}) {
  const author =
    m.sender === 'ADMIN' && m.author
      ? [m.author.firstName, m.author.lastName].filter(Boolean).join(' ') || m.author.email
      : t(`sender.${m.sender}`);

  return (
    <div className={`rounded-xl border p-4 ${SENDER_CLS[m.sender]}`}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-semibold text-slate-700">{author}</span>
        <span className="text-slate-400">{t(`sender.${m.sender}`)}</span>
        {m.viaEmail && <span className="text-slate-400">· {t('viaEmail')}</span>}
        <span className="ml-auto text-slate-400">
          {format.dateTime(new Date(m.createdAt), {
            day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>
      {/* Text zákazníka NIKDY cez dangerouslySetInnerHTML – whitespace-pre-wrap
          zachová zalomenia a React escapuje obsah sám. */}
      <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{m.body}</p>
      {m.hasAttachments && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Paperclip size={13} />
          {m.attachmentNote || t('hasAttachments')}
          <span className="text-slate-400">· {t('attachmentsNotStored')}</span>
        </p>
      )}
    </div>
  );
}
