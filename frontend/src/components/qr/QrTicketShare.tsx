'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { QrCode, Mail, MessageCircle, Link2, ImageIcon, Download, Check } from 'lucide-react';

const QR_BASE = 'https://ticketall.eu/q';

/**
 * QR v2 – zákaznícke zdieľanie rýchleho nákupu pri konkrétnom GA lístku.
 * Malá QR ikona → HOVER zväčší (skenovanie) → KLIK popover s akciami.
 * QR kóduje https://ticketall.eu/q/{ticketTypeId}.
 */
export function QrTicketShare({ ticketTypeId, ticketTypeName, showName }: {
  ticketTypeId: string;
  ticketTypeName: string;
  showName: string;
}) {
  const t = useTranslations('qrCheckout');
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<'' | 'link' | 'img'>('');
  const ref = useRef<HTMLDivElement>(null);

  const url = `${QR_BASE}/${ticketTypeId}`;
  const shareText = `${showName} – ${ticketTypeName}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setDataUrl).catch(() => {});
  }, [url]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function emailShare() {
    window.location.href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${t('shareBody')}\n${url}`)}`;
  }
  function whatsappShare() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`, '_blank', 'noopener');
  }
  function copyLink() {
    navigator.clipboard?.writeText(url).then(() => { setCopied('link'); setTimeout(() => setCopied(''), 1500); }).catch(() => {});
  }
  async function copyImage() {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied('img'); setTimeout(() => setCopied(''), 1500);
    } catch { /* clipboard image nepodporovaný */ }
  }
  function download() {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${ticketTypeName.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  const action = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors';

  return (
    <div ref={ref} className="group relative flex-shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title={t('shareTitle')}
        aria-label={t('shareTitle')}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-purple-700 hover:border-purple-300 hover:bg-purple-50 transition-colors"
      >
        <QrCode size={18} />
      </button>

      {/* HOVER zväčšenie (desktop, keď nie je otvorený popover) */}
      {dataUrl && !open && (
        <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg group-hover:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="QR" className="h-40 w-40" />
          <p className="mt-1 text-center text-[11px] text-slate-500">{t('shareScan')}</p>
        </div>
      )}

      {/* KLIK popover s akciami */}
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {dataUrl && <img src={dataUrl} alt="QR" className="h-44 w-44" />}
            <p className="mt-1 mb-2 text-center text-xs font-medium text-slate-700">{shareText}</p>
          </div>
          <div className="space-y-0.5">
            <button onClick={emailShare} className={action}><Mail size={16} /> {t('shareEmail')}</button>
            <button onClick={whatsappShare} className={action}><MessageCircle size={16} /> WhatsApp</button>
            <button onClick={copyLink} className={action}>{copied === 'link' ? <Check size={16} className="text-emerald-600" /> : <Link2 size={16} />} {t('shareCopyLink')}</button>
            <button onClick={copyImage} className={action}>{copied === 'img' ? <Check size={16} className="text-emerald-600" /> : <ImageIcon size={16} />} {t('shareCopyImage')}</button>
            <button onClick={download} className={action}><Download size={16} /> {t('shareDownload')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
