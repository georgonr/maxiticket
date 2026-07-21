/**
 * Pevný zoznam kategórií podujatia – jeden zdroj pre filter na /events aj pre
 * formuláre tvorby/editácie podujatia.
 *
 * `value` je kanonický SK string, ktorý ide do DB (Show.category) a ktorým sa
 * filtruje (backend robí presnú zhodu stringu). `labelKey` je i18n kľúč
 * v namespace `events`, takže sa zobrazí lokalizovane (SK/EN/CS), ale do DB
 * sa vždy uloží rovnaká kanonická hodnota.
 *
 * ZRKADLENÉ na backende: backend/src/common/show-categories.ts (@IsIn validácia).
 * Pri zmene zoznamu uprav OBA súbory – viď komentár tam pre dôvod duplicity.
 */
export const SHOW_CATEGORIES = [
  { value: 'Koncerty', labelKey: 'cat.concerts' },
  { value: 'Festivaly', labelKey: 'cat.festivals' },
  { value: 'Šport', labelKey: 'cat.sport' },
  { value: 'Konferencie', labelKey: 'cat.conferences' },
  { value: 'Divadlo', labelKey: 'cat.theatre' },
  { value: 'Ostatné', labelKey: 'cat.other' },
] as const;

export type ShowCategory = (typeof SHOW_CATEGORIES)[number]['value'];

export const SHOW_CATEGORY_VALUES: readonly string[] = SHOW_CATEGORIES.map((c) => c.value);

/** Je hodnota z DB stále v pevnom zozname? (edit formulár zobrazí staré hodnoty ako neplatné) */
export function isFixedCategory(value: string | null | undefined): boolean {
  return !!value && SHOW_CATEGORY_VALUES.includes(value);
}
