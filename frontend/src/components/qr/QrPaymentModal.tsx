'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { X, Download, Printer, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const QR_BASE = 'https://ticketall.eu/q';

/** Modal s QR kódom pre rýchly nákup (scan-to-buy) daného GA typu lístka. */
export function QrPaymentModal({ ticketTypeId, ticketTypeName, onClose }: {
  ticketTypeId: string;
  ticketTypeName: string;
  onClose: () => void;
}) {
  const t = useTranslations('qrCheckout');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const url = `${QR_BASE}/${ticketTypeId}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 260, margin: 2, color: { dark: '#111827', light: '#ffffff' } }).catch(() => {});
    }
  }, [url]);

  async function download() {
    const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${ticketTypeName.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function print() {
    const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2 });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>QR – ${ticketTypeName}</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;">
        <h2>${ticketTypeName}</h2>
        <img src="${dataUrl}" style="width:320px;height:320px;" />
        <p style="color:#555;font-size:13px;">${url}</p>
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  function copy() {
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('modalTitle')}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>

        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{t('modalHint', { name: ticketTypeName })}</p>

        <div className="flex justify-center">
          <canvas ref={canvasRef} className="rounded-lg border border-gray-200 dark:border-gray-700" />
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
    </div>
  );
}
