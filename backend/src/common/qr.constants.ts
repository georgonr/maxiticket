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
 * Zdrojové rozlíšenie QR pre e-mail a PDF lístok.
 *
 * PDF kreslí QR na fixných 130 bodov (~45,9 mm) cez doc.image(), takže `width`
 * neovplyvňuje fyzickú veľkosť – len rozlíšenie. 600 px na 130 bodoch vychádza
 * na ~332 ppi, teda nad tlačovým ideálom 300 ppi (pri 300 px to bolo ~166 ppi).
 */
export const QR_PRINT_WIDTH = 600;

/**
 * Options pre QRCode.toBuffer / toDataURL. `width` sa líši podľa použitia
 * (mail/PDF QR_PRINT_WIDTH, AI chat 240), zvyšok je spoločný.
 */
export function qrOptions(width: number) {
  return {
    width,
    margin: QR_MARGIN,
    color: { dark: QR_DARK, light: QR_LIGHT },
  };
}
