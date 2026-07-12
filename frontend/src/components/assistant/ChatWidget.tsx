'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { MessageCircle, X, Send, Download, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getValidToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api';

type QrItem = { ticketId: string; label: string; dataUrl: string };
type Attachment =
  | { type: 'qr'; orderNumber?: string; items: QrItem[] }
  | { type: 'pdf'; url: string; label: string; orderNumber?: string };

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
}

// Guest chat-session id (opaque UUID) – reuse počas session cez sessionStorage.
const GUEST_SID_KEY = 'assistant_guest_sid';
function getGuestSid(): string {
  try {
    let sid = sessionStorage.getItem(GUEST_SID_KEY);
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(GUEST_SID_KEY, sid); }
    return sid;
  } catch {
    return 'guest-' + Math.random().toString(36).slice(2, 12);
  }
}

export function ChatWidget() {
  const t = useTranslations('chat');
  const locale = useLocale();
  const { isAuthenticated, isCustomer } = useAuth();
  // Guest = ktokoľvek okrem prihláseného zákazníka (infobot); prihlásený customer = plný agent.
  const guestMode = !(isAuthenticated && isCustomer);
  const quickReplies = guestMode
    ? [t('quickGuestEvents'), t('quickGuestRegister'), t('quickGuestHowItWorks'), t('quickGuestRefund')]
    : [t('quickTicketNotReceived'), t('quickShowQr'), t('quickDownloadPdf'), t('quickResend')];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  // Widget je viditeľný pre VŠETKÝCH – guest dostane infobota, prihlásený plného agenta.

  async function downloadPdf(url: string, orderNumber?: string) {
    const token = await getValidToken();
    if (!token) return;
    const res = await fetch(`${API_BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `doklad-${orderNumber ?? 'objednavka'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput('');
    const history: ChatMsg[] = [...messages, { role: 'user', content: msg }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    setStatus('');

    try {
      const payloadMsgs = history.map((m) => ({ role: m.role, content: m.content }));
      let res: Response;
      if (guestMode) {
        // Guest → infobot endpoint (bez auth), s chatSessionId.
        res = await fetch(`${API_BASE}/v1/assistant/guest/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatSessionId: getGuestSid(), messages: payloadMsgs, locale }),
        });
      } else {
        // Prihlásený → plný agent (nezmenené).
        const token = await getValidToken();
        if (!token) throw new Error('Vyžaduje sa prihlásenie.');
        res = await fetch(`${API_BASE}/v1/assistant/chat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: payloadMsgs, locale }),
        });
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      const update = (fn: (m: ChatMsg) => ChatMsg) =>
        setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const ln = line.trim();
          if (!ln.startsWith('data:')) continue;
          let ev: any;
          try { ev = JSON.parse(ln.slice(5).trim()); } catch { continue; }
          if (ev.type === 'status') setStatus(ev.text);
          else if (ev.type === 'delta') { setStatus(''); update((m) => ({ ...m, content: m.content + ev.text })); }
          else if (ev.type === 'attachment') update((m) => ({ ...m, attachments: [...(m.attachments ?? []), ev.attachment] }));
          else if (ev.type === 'error') update((m) => ({ ...m, content: (m.content ? m.content + '\n\n' : '') + '⚠️ ' + ev.message }));
          else if (ev.type === 'done') setStatus('');
        }
      }
    } catch {
      setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: m.content || ('⚠️ ' + t('unavailable')) } : m)));
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-coral text-white shadow-lg hover:bg-coral-dark"
          aria-label={t('open')}
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[32rem] max-h-[80vh] w-[22rem] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-coral px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <span className="font-semibold text-sm">{t('title')}</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t('close')}><X size={18} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {messages.length === 0 && (
              <div className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
                <p>{guestMode ? t('welcomeGuest') : t('welcome')}</p>
                {guestMode && (
                  <Link
                    href="/account/login"
                    className="mt-2 inline-block font-medium text-coral hover:text-coral-dark"
                  >
                    {t('loginCta')} →
                  </Link>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-coral text-white' : 'bg-white text-slate-800 shadow-sm'}`}>
                  {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                  {m.attachments?.map((att, j) => (
                    <div key={j} className="mt-2">
                      {att.type === 'qr' && (
                        <div className="grid grid-cols-2 gap-2">
                          {att.items.map((q) => (
                            <div key={q.ticketId} className="rounded-lg border border-slate-200 bg-white p-1.5 text-center">
                              <img src={q.dataUrl} alt={`QR ${q.label}`} className="w-full" />
                              <p className="mt-1 text-[10px] text-slate-500">{q.label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {att.type === 'pdf' && (
                        <button
                          onClick={() => downloadPdf(att.url, att.orderNumber)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-coral/30 px-3 py-1.5 text-xs font-medium text-coral hover:bg-coral/5"
                        >
                          <Download size={14} /> {att.label}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {status && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 size={13} className="animate-spin" /> {status}
              </div>
            )}
          </div>

          {/* Quick replies */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 p-2">
              {quickReplies.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={busy} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-slate-200 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              disabled={busy}
              className="flex-1 rounded-full border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <button type="submit" disabled={busy || !input.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-coral text-white hover:bg-coral-dark disabled:opacity-40" aria-label={t('send')}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
