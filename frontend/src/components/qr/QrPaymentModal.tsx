'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { X, Download, Printer, Copy, Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QrCodeBox, QR_DARK, QR_LIGHT, QR_MARGIN } from './QrCodeBox';

const QR_BASE = 'https://ticketall.eu/q';
const MAX_QTY = 10;
/** Zobrazená veľkosť QR – POS QR skenujú zákazníci z displeja, drž ho veľký. */
const QR_DISPLAY = 260;

/**
 * Modal s QR kódom pre rýchly nákup (scan-to-buy) daného GA typu lístka.
 * Voliteľný počet (initialQty z POS kontextu) → kóduje sa do URL ako ?qty=N (>1).
 */
export function QrPaymentModal({ ticketTypeId, ticketTypeName, initialQty, showQtyPicker = true, instruction, onClose }: {
  ticketTypeId: string;
  ticketTypeName: string;
  initialQty?: number;
  showQtyPicker?: boolean;
  instruction?: string;
  onClose: () => void;
}) {
  const t = useTranslations('qrCheckout');
  const [copied, setCopied] = useState(false);
  const [qty, setQty] = useState(Math.min(MAX_QTY, Math.max(1, initialQty ?? 1)));
  const [mounted, setMounted] = useState(false);

  const url = `${QR_BASE}/${ticketTypeId}${qty > 1 ? `?qty=${qty}` : ''}`;

  useEffect(() => setMounted(true), []);

  /** Farby držíme explicitne (nie defaulty knižnice) – rovnaký kontrakt ako QrCodeBox. */
  const exportOpts = { width: 1024, margin: QR_MARGIN, color: { dark: QR_DARK, light: QR_LIGHT } };

  async function download() {
    const dataUrl = await QRCode.toDataURL(url, exportOpts);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${ticketTypeName.replace(/\s+/g, '-').toLowerCase()}${qty > 1 ? `-${qty}x` : ''}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function print() {
    const dataUrl = await QRCode.toDataURL(url, exportOpts);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>QR – ${ticketTypeName}</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;">
        <h2>${ticketTypeName}${qty > 1 ? ` × ${qty}` : ''}</h2>
        <img src="${dataUrl}" style="width:320px;height:320px;" />
        <p style="color:#555;font-size:13px;">${url}</p>
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  function copy() {
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  if (!mounted) return null;

  /*
    Render cez PORTÁL do document.body – rovnaký bezpečný vzor ako QrTicketShare
    a EventCard QrModal. CSS opacity/filter/transform na ktoromkoľvek predkovi
    (POS zoznam lístkov, vypredané dlaždice) sa dedí na celý podstrom vrátane
    position:fixed a spravil by QR polopriehľadným, teda nenaskenovateľným.
  */
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('modalTitle')}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>

        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{instruction ?? t('modalHint', { name: ticketTypeName })}</p>

        {showQtyPicker && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('quantity')}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 disabled:opacity-40"><Minus size={15} /></button>
              <span className="w-6 text-center text-base font-bold tabular-nums">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))} disabled={qty >= MAX_QTY}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 disabled:opacity-40"><Plus size={15} /></button>
            </div>
          </div>
        )}

        {/* QR ostáva čisto čierno-biely a nepriehľadný aj keď je panel v dark režime. */}
        <div className="flex justify-center">
          <QrCodeBox value={url} size={QR_DISPLAY} />
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-600 dark:text-gray-300">{url}</span>
          <button onClick={copy} className="text-gray-400 hover:text-emerald-600">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={download}><Download size={15} className="mr-1.5" /> {t('download')}</Button>
          <Button variant="outline" onClick={print}><Printer size={15} className="mr-1.5" /> {t('print')}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
