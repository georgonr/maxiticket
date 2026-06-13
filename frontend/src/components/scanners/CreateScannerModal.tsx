'use client';

import { useState } from 'react';
import { X, RefreshCw, Copy, Check, AlertTriangle } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { scannersApi, Scanner } from '@/lib/api/scanners';
import { Button } from '@/components/ui/button';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

/** Náhodné heslo (14 znakov) cez crypto – bez zámen 0/O/1/l. */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function CreateScannerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState(generatePassword());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Scanner | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit() {
    setError('');
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError('Zadajte platný e-mail.');
      return;
    }
    if (password.length < 8) {
      setError('Heslo musí mať aspoň 8 znakov.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('Vyžaduje sa prihlásenie.');
      const scanner = await scannersApi.create(
        { email: mail, password, name: name.trim() || undefined },
        token,
      );
      setCreated(scanner);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vytvorenie scannera zlyhalo.');
      setSubmitting(false);
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(password).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={created ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {created ? 'Scanner vytvorený' : 'Pridať skenera'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600"
            aria-label="Zavrieť"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {created ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  Heslo sa zobrazuje <strong>iba teraz</strong>. Skopírujte ho a odovzdajte
                  skenerovi – už ho nebude možné zobraziť.
                </span>
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">E-mail</span>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                  {created.email}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Heslo</span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 font-mono text-sm text-gray-900 dark:text-gray-100">
                    {password}
                  </code>
                  <button
                    onClick={copyPassword}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    {copied ? 'Skopírované' : 'Kopírovať'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">E-mail *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="skener@example.sk"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Meno</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="napr. Vstup – hlavný"
                  className={inputCls}
                />
              </label>
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Heslo *</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls + ' font-mono'}
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    title="Vygenerovať nové heslo"
                  >
                    <RefreshCw size={15} /> Generovať
                  </button>
                </div>
                <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">Min. 8 znakov.</span>
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
          {created ? (
            <Button onClick={() => onCreated(`Scanner ${created.email} vytvorený.`)}>Hotovo</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Zrušiť
              </Button>
              <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
                Vytvoriť
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
