/**
 * Pevný zoznam kategórií podujatia.
 *
 * Hodnoty sú kanonické SK stringy – presne to, čo sa ukladá do Show.category
 * a čím sa filtruje na /events (public.service.ts robí presnú zhodu stringu).
 * Zobrazovaný label lokalizuje frontend cez `events.cat.*` kľúče, takže tieto
 * hodnoty sa NEPREKLADAJÚ a nesmú sa meniť bez migrácie dát.
 *
 * ZRKADLENÉ vo frontende: frontend/src/lib/show-categories.ts
 * Pri zmene zoznamu uprav OBA súbory.
 *
 * Prečo dve kópie a nie jeden zdieľaný modul: backend a frontend sú samostatné
 * npm balíky so samostatným docker build kontextom (infra/docker-compose.yml
 * používa context ../backend resp. ../frontend), takže súbor mimo týchto
 * adresárov by ani jeden build nevidel. Zdieľanie by si vyžiadalo nový
 * workspace balík + prepis oboch Dockerfile-ov – neúmerné pre 6 hodnôt.
 */
export const SHOW_CATEGORIES = [
  'Koncerty',
  'Festivaly',
  'Šport',
  'Konferencie',
  'Divadlo',
  'Ostatné',
] as const;

export type ShowCategory = (typeof SHOW_CATEGORIES)[number];
