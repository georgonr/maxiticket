/**
 * Jednotný kontrakt pre generovanie QR na backende.
 *
 * Musí sedieť s frontendovým QrCodeBox (frontend/src/components/qr/QrCodeBox.tsx):
 * čisto čierna na čisto bielej + quiet zone 4 moduly. QR z e-mailu, PDF lístka
 * aj AI chatu sa reálne skenuje pri vstupe na podujatie, takže kontrast a šírka
 * quiet zone sú kritické – nie kozmetika.
 *
 * Farby držíme explicitne, nie cez defaulty knižnice: default sa môže zmeniť
 * medzi verziami a QR sa nikdy nefarbí.
 */
export const QR_DARK = '#000000';
export const QR_LIGHT = '#FFFFFF';
/** Štandardná quiet zone = 4 moduly. */
export const QR_MARGIN = 4;

/**
 * Options pre QRCode.toBuffer / toDataURL. `width` sa líši podľa použitia
 * (mail/PDF 300, AI chat 240), zvyšok je spoločný.
 */
export function qrOptions(width: number) {
  return {
    width,
    margin: QR_MARGIN,
    color: { dark: QR_DARK, light: QR_LIGHT },
  };
}
