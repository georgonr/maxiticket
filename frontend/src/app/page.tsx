import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Root "/" – redirect based on area detected by middleware
export default function RootPage() {
  const area = headers().get('x-area') ?? 'public';
  if (area === 'admin') redirect('/login');
  if (area === 'scanner') redirect('/scan');
  // public: render inline (Next.js route group layouts not supported at root redirect)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white font-bold text-xl">MT</div>
      <h1 className="text-4xl font-bold tracking-tight">Maxiticket</h1>
      <p className="text-lg text-gray-500">Predaj vstupeniek online – pre organizátorov aj návštevníkov.</p>
      <div className="mt-4 flex gap-3">
        <a
          href="https://admin.maxiticket.africa/register"
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Zaregistrovať sa ako organizátor
        </a>
        <a
          href="https://admin.maxiticket.africa/login"
          className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Prihlásiť sa
        </a>
      </div>
    </main>
  );
}
