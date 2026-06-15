'use client';

import { useState } from 'react';
import { Mail, MapPin, Send, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.ticketall.eu';

type Status = 'idle' | 'sending' | 'ok' | 'error';

export default function KontaktPage() {
  const [form, setForm] = useState({ meno: '', email: '', predmet: '', sprava: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrMsg('');
    try {
      const res = await fetch(`${API_BASE}/v1/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setErrMsg('Príliš veľa správ. Skúste to znova o hodinu.');
        } else {
          setErrMsg(data?.message ?? 'Nastala chyba. Skúste to znova.');
        }
        setStatus('error');
        return;
      }
      setStatus('ok');
      setForm({ meno: '', email: '', predmet: '', sprava: '' });
    } catch {
      setErrMsg('Nepodarilo sa odoslať správu. Skúste neskôr.');
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">Kontakt</h1>
      <p className="mb-12 text-slate-500">
        Máte otázku? Napíšte nám – odpovieme do 1 pracovného dňa.
      </p>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Contact form */}
        <div>
          {status === 'ok' ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
              <CheckCircle size={32} className="text-emerald-600" />
              <h2 className="text-lg font-semibold text-emerald-800">Správa odoslaná!</h2>
              <p className="text-sm text-emerald-700">
                Ďakujeme. Ozveme sa na vašu e-mailovú adresu čo najskôr.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="mt-2 text-sm font-medium text-emerald-700 underline hover:no-underline"
              >
                Odoslať ďalšiu správu
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="meno">
                    Meno a priezvisko
                  </label>
                  <input
                    id="meno"
                    name="meno"
                    type="text"
                    required
                    maxLength={100}
                    value={form.meno}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    placeholder="Ján Novák"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
                    E-mail
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    placeholder="jan@priklad.sk"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="predmet">
                  Predmet
                </label>
                <select
                  id="predmet"
                  name="predmet"
                  required
                  value={form.predmet}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                >
                  <option value="">Vyberte predmet…</option>
                  <option>Otázka k objednávke</option>
                  <option>Technický problém</option>
                  <option>Vrátenie lístka</option>
                  <option>Spolupráca / organizátor</option>
                  <option>Iné</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="sprava">
                  Správa
                </label>
                <textarea
                  id="sprava"
                  name="sprava"
                  required
                  rows={5}
                  maxLength={2000}
                  value={form.sprava}
                  onChange={handleChange}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  placeholder="Popíšte vašu požiadavku…"
                />
                <p className="mt-1 text-right text-xs text-slate-400">{form.sprava.length} / 2000</p>
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {errMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-60 transition-colors"
              >
                <Send size={14} />
                {status === 'sending' ? 'Odosielam…' : 'Odoslať správu'}
              </button>
            </form>
          )}
        </div>

        {/* Contact details */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-800">Kontaktné údaje</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail size={16} className="mt-0.5 flex-shrink-0 text-purple-500" />
                <div>
                  <p className="text-xs font-medium text-slate-500">E-mail</p>
                  <a href="mailto:info@ticketall.eu" className="text-sm text-slate-800 hover:text-purple-600 transition-colors">
                    info@ticketall.eu
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 flex-shrink-0 text-purple-500" />
                <div>
                  <p className="text-xs font-medium text-slate-500">Adresa</p>
                  <p className="text-sm text-slate-800">MaceT s.r.o.<br />Slovenská republika</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-base font-semibold text-slate-800">Prevádzkovateľ</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              MaceT s.r.o. je prevádzkovateľom platformy TicketAll a je zodpovedný za spracúvanie osobných
              údajov v súlade s nariadením GDPR.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
