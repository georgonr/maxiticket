'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { QrCode, Mail, MessageCircle, Link2, ImageIcon, Download, Check, X } from 'lucide-react';
import { QrCodeBox, QR_DARK, QR_LIGHT, QR_MARGIN } from './QrCodeBox';

const QR_BASE = 'https://ticketall.eu/q';

/** Zobrazená veľkosť QR (−30 % oproti pôvodným 220 px). */
const QR_DISPLAY = 154;

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
  const [mounted, setMounted] = useState(false);

  const url = `${QR_BASE}/${ticketTypeId}`;
  const shareText = `${showName} – ${ticketTypeName}`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // Vysoké rozlíšenie len pre stiahnutie/kopírovanie obrázka;
    // zobrazenie si rieši QrCodeBox vlastným renderom v presnej veľkosti.
    QRCode.toDataURL(url, { width: 1024, margin: QR_MARGIN, color: { dark: QR_DARK, light: QR_LIGHT } })
      .then(setDataUrl).catch(() => {});
  }, [url]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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

  const action = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-coral/10 hover:text-coral transition-colors';

  return (
    <div className="flex-shrink-0">
      <button
        onClick={() => setOpen(true)}
        title={`${t('shareTitle')} — ${t('clickToEnlarge')}`}
        aria-label={`${t('shareTitle')} — ${t('clickToEnlarge')}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-coral hover:border-coral/40 hover:bg-coral/10 transition-colors"
      >
        <QrCode size={18} />
      </button>

      {/*
        KLIK → modal cez PORTÁL do document.body. Portál je kritický: riadok typu
        lístka na detaile podujatia môže mať `opacity-60` (vypredané / mimo predaja)
        a CSS opacity sa dedí na VŠETKÝCH potomkov vrátane position:fixed – modal
        aj QR by boli polopriehľadné (a teda nenaskenovateľné). Portál to obchádza.
        Zatvorenie: X, klik na backdrop, Esc.
      */}
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-base font-bold text-plum">{t('shareTitle')}</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center">
              <QrCodeBox value={url} size={QR_DISPLAY} />
              <p className="mt-2.5 text-center text-sm font-medium text-plum">{shareText}</p>
              <p className="mb-3 text-center text-xs text-muted">{t('shareScan')}</p>
            </div>

            <div className="space-y-0.5">
              <button onClick={emailShare} className={action}><Mail size={16} /> {t('shareEmail')}</button>
              <button onClick={whatsappShare} className={action}><MessageCircle size={16} /> WhatsApp</button>
              <button onClick={copyLink} className={action}>{copied === 'link' ? <Check size={16} className="text-emerald-600" /> : <Link2 size={16} />} {t('shareCopyLink')}</button>
              <button onClick={copyImage} className={action}>{copied === 'img' ? <Check size={16} className="text-emerald-600" /> : <ImageIcon size={16} />} {t('shareCopyImage')}</button>
              <button onClick={download} className={action}><Download size={16} /> {t('shareDownload')}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
