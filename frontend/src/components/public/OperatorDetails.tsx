import type { PlatformInfoPublic } from '@/lib/api';

/**
 * Identifikačné údaje prevádzkovateľa pre /gdpr a /kontakt (krok 30).
 *
 * Čisto prezentačný komponent – dáta prichádzajú z PlatformInfo cez
 * /v1/public/platform-info, NIE z i18n. Predtým bol názov firmy natvrdo
 * v JSX aj v prekladoch, takže zmena prevádzkovateľa znamenala editovať
 * štyri súbory a aj tak sa to rozišlo s faktúrami.
 *
 * Chýbajúce polia sa vynechávajú – nikdy sa nedopĺňa náhradná hodnota.
 */
export function OperatorDetails({ info }: { info: PlatformInfoPublic | null }) {
  if (!info) {
    // Dáta sa načítavajú na serveri (krok 40). Ak sú null, endpoint/DB zlyhali –
    // nenechaj povinné údaje zmiznúť bez stopy: v dev upozorni, v prod to už
    // zalogoval server fetch (platform-info.server.ts).
    if (process.env.NODE_ENV !== 'production') {
      console.warn('OperatorDetails: chýbajú údaje prevádzkovateľa (info=null).');
    }
    return null;
  }

  const city = [info.addressZip, info.addressCity].filter(Boolean).join(' ');
  const country = info.addressCountry === 'SK' ? 'Slovenská republika' : info.addressCountry;
  const idLines = [
    info.ico ? `IČO: ${info.ico}` : null,
    info.dic ? `DIČ: ${info.dic}` : null,
    info.icDph ? `IČ DPH: ${info.icDph}` : null,
  ].filter(Boolean) as string[];

  return (
    <address className="not-italic text-sm leading-relaxed text-slate-700">
      {info.legalName && <p className="font-semibold text-slate-900">{info.legalName}</p>}
      {info.addressStreet && <p>{info.addressStreet}</p>}
      {(city || country) && <p>{[city, country].filter(Boolean).join(', ')}</p>}
      {idLines.length > 0 && <p className="mt-2 text-slate-600">{idLines.join(' · ')}</p>}
      {info.registrationNote && (
        <p className="mt-2 text-xs text-slate-500">{info.registrationNote}</p>
      )}
      {info.contactEmail && (
        <p className="mt-2">
          <a href={`mailto:${info.contactEmail}`} className="text-coral hover:underline">
            {info.contactEmail}
          </a>
        </p>
      )}
      {info.contactPhone && <p>{info.contactPhone}</p>}
    </address>
  );
}
