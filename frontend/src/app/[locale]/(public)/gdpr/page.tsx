export default function GdprPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-slate-900">
        Ochrana osobných údajov
      </h1>
      <div className="space-y-6 text-sm leading-relaxed text-slate-700">

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Prevádzkovateľ</h2>
          <p>
            Prevádzkovateľom osobných údajov je spoločnosť <strong>MaceT s.r.o.</strong>, so sídlom na Slovensku
            (presná adresa bude doplnená). Kontakt: <a href="mailto:info@ticketall.eu" className="text-purple-600 hover:underline">info@ticketall.eu</a>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Aké údaje zbierame?</h2>
          <ul className="ml-4 list-disc space-y-1 text-slate-600">
            <li>Meno a priezvisko</li>
            <li>E-mailová adresa</li>
            <li>História objednávok a zakúpených lístkov</li>
            <li>IP adresa (pre bezpečnosť a audit)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Na aký účel?</h2>
          <ul className="ml-4 list-disc space-y-1 text-slate-600">
            <li>Správa zákazníckeho účtu a autentifikácia</li>
            <li>Vybavenie objednávky a doručenie lístkov</li>
            <li>Zákaznícka podpora a komunikácia</li>
            <li>Plnenie zákonných povinností (účtovníctvo, daňové doklady)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Doba uchovávania</h2>
          <p>
            Osobné údaje uchovávame po dobu trvania zmluvného vzťahu a ďalej v súlade so zákonnými lehotami (5 rokov
            pre daňové doklady, 10 rokov pre účtovné záznamy). Po uplynutí týchto lehôt sú údaje bezpečne vymazané.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Vaše práva</h2>
          <ul className="ml-4 list-disc space-y-1 text-slate-600">
            <li>Právo na prístup k osobným údajom</li>
            <li>Právo na opravu nesprávnych údajov</li>
            <li>Právo na výmaz („právo byť zabudnutý")</li>
            <li>Právo na obmedzenie spracúvania</li>
            <li>Právo na prenosnosť údajov</li>
            <li>Právo namietať spracúvanie</li>
          </ul>
          <p className="mt-2">
            Žiadosť o uplatnenie práv zasielajte na{' '}
            <a href="mailto:info@ticketall.eu" className="text-purple-600 hover:underline">
              info@ticketall.eu
            </a>
            . Odpovieme do 30 dní.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Sťažnosti</h2>
          <p>
            Ak sa domnievate, že spracúvanie vašich osobných údajov porušuje nariadenie GDPR, máte právo podať sťažnosť
            na Úrad na ochranu osobných údajov SR (
            <a href="https://dataprotection.gov.sk" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
              dataprotection.gov.sk
            </a>
            ).
          </p>
        </section>

        <p className="text-xs text-slate-400">Posledná aktualizácia: máj 2025</p>
      </div>
    </div>
  );
}
