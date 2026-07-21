'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Zdieľaný QR box – jediné miesto, kde je definovaný „kontrakt naskenovateľnosti“.
 *
 * QR sa NIKDY nefarbí: čisto čierna na čisto bielej. Box je vždy plne
 * nepriehľadne biely (bg-white, žiadna opacity) a má vlastný biely padding
 * navyše k quiet zone v samotnom QR – aby cezeň nikdy nepresvital obsah
 * stránky ani pri poloprehľadnom paneli. Rámik je coral (branding).
 *
 * Používajú ho QrTicketShare (rýchly nákup lístka) aj EventCard QrModal
 * (zdieľanie URL podujatia); modaly samotné ostávajú oddelené, lebo majú
 * odlišný obsah a akcie.
 */

export const QR_DARK = '#000000';
export const QR_LIGHT = '#FFFFFF';
/** Štandardná quiet zone = 4 moduly. */
export const QR_MARGIN = 4;

/**
 * Vygeneruje QR ako data URL. `width` je cieľové rozlíšenie v px –
 * renderuj priamo v požadovanej veľkosti (×3 pre retina), downscale
 * z veľkého PNG rozmazáva moduly a zhoršuje skenovanie.
 */
export function useQrDataUrl(value: string, width: number) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width,
      margin: QR_MARGIN,
      color: { dark: QR_DARK, light: QR_LIGHT },
    })
      .then((d) => { if (alive) setSrc(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [value, width]);
  return src;
}

export function QrCodeBox({ value, size, className = '' }: {
  value: string;
  /** Zobrazená veľkosť v CSS px. */
  size: number;
  className?: string;
}) {
  const src = useQrDataUrl(value, size * 3);

  return (
    <div className={`rounded-xl border-2 border-coral/30 bg-white p-3 ${className}`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="QR"
          width={size}
          height={size}
          style={{ width: size, height: size, display: 'block', backgroundColor: QR_LIGHT }}
        />
      )}
    </div>
  );
}
