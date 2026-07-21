/**
 * Slug z ľudského názvu: odstráni diakritiku (NFD + zahodenie kombinujúcich
 * znamienok), zníži na malé písmená, čokoľvek mimo [a-z0-9] nahradí pomlčkou
 * a oreže pomlčky na okrajoch. Výsledok vyhovuje ^[a-z0-9-]+$.
 *
 * Môže vrátiť PRÁZDNY string, ak z názvu nezostane nič použiteľné – napr.
 * "!!!" alebo názov v nelatinkovom písme. Volajúci MUSÍ mať fallback.
 */
export function slugify(value: string, maxLength = 60): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
