export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-slate-900">Zásady používania cookies</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-700">

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Čo sú cookies?</h2>
          <p>
            Cookies sú malé textové súbory, ktoré webová stránka ukladá vo vašom prehliadači pri návšteve. Pomáhajú
            stránke zapamätať si vaše preferencie a prihlasovací stav.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Aké cookies používame?</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Typ</th>
                  <th className="px-4 py-3 font-semibold">Účel</th>
                  <th className="px-4 py-3 font-semibold">Doba platnosti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Nevyhnutné</td>
                  <td className="px-4 py-3 text-slate-600">Udržiavanie prihlasovacieho stavu, bezpečnosť relácie</td>
                  <td className="px-4 py-3 text-slate-600">Session / 30 dní</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Funkčné</td>
                  <td className="px-4 py-3 text-slate-600">Zapamätanie košíka a preferencií zobrazovania</td>
                  <td className="px-4 py-3 text-slate-600">7 dní</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            V súčasnosti <strong>nepoužívame sledovacie ani reklamné cookies</strong> tretích strán.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Ako spravovať cookies?</h2>
          <p>
            Väčšina moderných prehliadačov umožňuje cookies spravovať alebo odstrániť v nastaveniach. Vypnutie
            nevyhnutných cookies môže narušiť fungovanie prihlásenia a nákupu lístkov.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Kontakt</h2>
          <p>
            Otázky ohľadom cookies zasielajte na{' '}
            <a href="mailto:info@ticketall.eu" className="text-purple-600 hover:underline">
              info@ticketall.eu
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-slate-400">Posledná aktualizácia: máj 2025</p>
      </div>
    </div>
  );
}
