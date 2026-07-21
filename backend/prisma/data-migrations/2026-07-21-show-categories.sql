-- Jednorazová migrácia DÁT (nie schémy) – kategórie podujatí na pevný zoznam.
--
-- Kontext: Show.category bola voľný text, takže organizátori vpisovali vlastné
-- hodnoty a každá sa vysypala ako samostatná pilulka do filtra na /events.
-- Od commitu 2b82089 je zoznam pevný a backend ho vynucuje cez @IsIn, takže
-- nové voľné hodnoty už nevzniknú. Tento skript dorovnáva existujúce dáta.
--
-- Spúšťať AŽ PO nasadení @IsIn validácie, inak medzitým pribudnú ďalšie.
-- Spustené: 2026-07-21, 8 riadkov, 31 podujatí celkovo (počet zachovaný).
--
--   Hudba, popovy koncert -> Koncerty
--   Konferencia           -> Konferencie   (jednotné vs. množné číslo)
--   Festival              -> Festivaly     (jednotné vs. množné číslo)
--   zabava                -> Ostatné
--   Komédia, Tanec        -> Divadlo

BEGIN;

UPDATE "Show" SET category = 'Koncerty'    WHERE category IN ('Hudba', 'popovy koncert');
UPDATE "Show" SET category = 'Konferencie' WHERE category = 'Konferencia';
UPDATE "Show" SET category = 'Festivaly'   WHERE category = 'Festival';
UPDATE "Show" SET category = 'Ostatné'     WHERE category = 'zabava';
UPDATE "Show" SET category = 'Divadlo'     WHERE category IN ('Komédia', 'Tanec');

-- Poistka: po migrácii nesmie zostať nič mimo pevného zoznamu (očakávané 0).
SELECT COUNT(*) AS zostava_mimo_zoznamu
FROM "Show"
WHERE category IS NOT NULL
  AND category NOT IN ('Koncerty', 'Festivaly', 'Šport', 'Konferencie', 'Divadlo', 'Ostatné');

COMMIT;
