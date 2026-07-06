'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { QrCode, Mail, MessageCircle, Link2, ImageIcon, Download, Check, X } from 'lucide-react';

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

  const url = `${QR_BASE}/${ticketTypeId}`;
  const shareText = `${showName} – ${ticketTypeName}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setDataUrl).catch(() => {});
  }, [url]);

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

  const action = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors';

  return (
    <div className="flex-shrink-0">
      <button
        onClick={() => setOpen(true)}
        title={`${t('shareTitle')} — ${t('clickToEnlarge')}`}
        aria-label={`${t('shareTitle')} — ${t('clickToEnlarge')}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-purple-700 hover:border-purple-300 hover:bg-purple-50 dark:border-gray-700 dark:text-purple-300 dark:hover:bg-gray-800 transition-colors"
      >
        <QrCode size={18} />
      </button>

      {/* KLIK → modal (overlay); zatvorenie len X alebo klik na backdrop. */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('shareTitle')}</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {dataUrl && <img src={dataUrl} alt="QR" width={220} height={220} style={{ width: 220, height: 220, display: 'block', imageRendering: 'pixelated' }} className="aspect-square rounded-lg border border-gray-200 dark:border-gray-700 object-contain" />}
              <p className="mt-2 text-center text-sm font-medium text-gray-800 dark:text-gray-100">{shareText}</p>
              <p className="mb-3 text-center text-xs text-gray-500 dark:text-gray-400">{t('shareScan')}</p>
            </div>

            <div className="space-y-0.5">
              <button onClick={emailShare} className={action}><Mail size={16} /> {t('shareEmail')}</button>
              <button onClick={whatsappShare} className={action}><MessageCircle size={16} /> WhatsApp</button>
              <button onClick={copyLink} className={action}>{copied === 'link' ? <Check size={16} className="text-emerald-600" /> : <Link2 size={16} />} {t('shareCopyLink')}</button>
              <button onClick={copyImage} className={action}>{copied === 'img' ? <Check size={16} className="text-emerald-600" /> : <ImageIcon size={16} />} {t('shareCopyImage')}</button>
              <button onClick={download} className={action}><Download size={16} /> {t('shareDownload')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
