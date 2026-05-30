import Link from 'next/link';
import type { Metadata } from 'next';
import { TicketCheck, QrCode, BarChart3, CreditCard, Users, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pre organizátorov – TicketAll',
  description: 'Predávajte vstupenky na vaše podujatia jednoducho a bezpečne cez TicketAll.',
};

const BENEFITS = [
  {
    icon: Zap,
    title: 'Spustenie za 5 minút',
    desc: 'Zaregistrujte sa, vytvorte podujatie a okamžite prijímajte platby. Žiadna inštalácia softvéru.',
  },
  {
    icon: CreditCard,
    title: 'Bezpečné online platby',
    desc: 'Integrované platby cez Stripe. Výnosy sú prevádzané priamo na váš účet po skončení podujatia.',
  },
  {
    icon: QrCode,
    title: 'Skener vstupeniek v mobile',
    desc: 'PWA skener funguje ako aplikácia bez inštalácie. Skenujte QR kódy priamo na vstupe.',
  },
  {
    icon: BarChart3,
    title: 'Prehľad v reálnom čase',
    desc: 'Sledujte predaje, no-show rate a obsadenosť v reálnom čase priamo v dashboarde.',
  },
  {
    icon: Users,
    title: 'Tímová spolupráca',
    desc: 'Pridajte členov tímu a skenerov. Každý má prístup len k tomu, čo potrebuje.',
  },
  {
    icon: TicketCheck,
    title: 'Zákaznícka podpora',
    desc: 'Náš tím je k dispozícii pri prvom podujatí. Pomôžeme vám s nastavením aj technicky.',
  },
];

export default function PreOrganizatorovPage() {
  return (
    <div className="py-10">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center px-4 pb-14">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-rose-500 shadow-lg">
          <TicketCheck size={32} className="text-white" strokeWidth={2.2} />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl leading-tight">
          Predávajte vstupenky<br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-purple-600 to-rose-500 bg-clip-text text-transparent"> s TicketAll</span>
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto">
          Platforma pre organizátorov podujatí. Online predaj, QR skener na vstupe,
          prehľadné štatistiky – všetko na jednom mieste.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://admin.ticketall.eu/register"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-rose-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-rose-600 shadow-sm hover:shadow transition-all"
          >
            Začať zadarmo
          </a>
          <Link
            href="/kontakt"
            className="rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Kontaktujte nás
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-400">Bez záväzkov. Platíte len percento z predaných lístkov.</p>
      </section>

      {/* Benefits grid */}
      <section className="mx-auto max-w-4xl px-4">
        <h2 className="text-center text-2xl font-bold text-slate-900 mb-8">Čo získate</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                <Icon size={20} className="text-purple-600" strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="mx-auto max-w-2xl px-4 mt-14 text-center">
        <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-rose-500 p-8 text-white shadow-lg">
          <h2 className="text-2xl font-bold mb-2">Pripravení začať?</h2>
          <p className="text-purple-100 mb-6 text-sm">
            Registrácia trvá menej ako 5 minút. Prvé podujatie môžete spustiť ešte dnes.
          </p>
          <a
            href="https://admin.ticketall.eu/register"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl bg-white px-8 py-3 text-base font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
          >
            Zaregistrovať sa ako organizátor
          </a>
          <p className="mt-4 text-xs text-purple-200">
            Máte otázky?{' '}
            <Link href="/kontakt" className="underline hover:text-white">
              Napíšte nám
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
