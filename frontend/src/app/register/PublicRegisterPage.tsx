import Link from 'next/link';
import { TicketCheck, Store } from 'lucide-react';

export function PublicRegisterPage() {
  return (
    <div className="py-12 px-4">
      <div className="mx-auto max-w-2xl text-center mb-10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-rose-500 shadow-lg">
          <TicketCheck size={28} className="text-white" strokeWidth={2.2} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          Vitajte v TicketAll
        </h1>
        <p className="mt-3 text-lg text-slate-500">
          Vyberte si, čo vás priviedlo:
        </p>
      </div>

      <div className="mx-auto grid max-w-2xl gap-5 sm:grid-cols-2">
        {/* Zákazník */}
        <div className="flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-7 shadow-sm hover:border-purple-300 hover:shadow-md transition-all">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
            <TicketCheck size={24} className="text-purple-600" strokeWidth={2} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Som zákazník</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500">Chcem kúpiť vstupenky</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2"><span className="mt-0.5 text-purple-500">✓</span>Kúpa vstupeniek na podujatia</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-purple-500">✓</span>História objednávok na jednom mieste</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-purple-500">✓</span>QR vstupenky v mobile, PDF na tlač</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-purple-500">✓</span>Rýchla kúpa bez zbytočných krokov</li>
          </ul>
          <Link
            href="/account/register"
            className="mt-6 block rounded-xl bg-purple-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
          >
            Zaregistrovať sa ako zákazník
          </Link>
          <p className="mt-3 text-center text-xs text-slate-400">
            Máte účet?{' '}
            <Link href="/account/login" className="text-purple-600 hover:underline">Prihláste sa</Link>
          </p>
        </div>

        {/* Organizátor */}
        <div className="flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-7 shadow-sm hover:border-rose-300 hover:shadow-md transition-all">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
            <Store size={24} className="text-rose-500" strokeWidth={2} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Som organizátor</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500">Chcem predávať vstupenky</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2"><span className="mt-0.5 text-rose-500">✓</span>Vlastný portál pre správu podujatí</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-rose-500">✓</span>Online predaj s okamžitým platením</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-rose-500">✓</span>QR skener vstupeniek (PWA, bez inštalácie)</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-rose-500">✓</span>Štatistiky predaja a výplata výnosov</li>
          </ul>
          <a
            href="https://admin.ticketall.eu/register"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block rounded-xl bg-rose-500 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-rose-600 transition-colors"
          >
            Zaregistrovať sa ako organizátor
          </a>
          <p className="mt-3 text-center text-xs text-slate-400">
            Viac info:{' '}
            <Link href="/pre-organizatorov" className="text-rose-500 hover:underline">Pre organizátorov</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
