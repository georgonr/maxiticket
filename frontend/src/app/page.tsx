import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Krok 31a: koreň `/`. Na admin/scanner subdoméne (middleware obíde locale) redirect podľa areny.
// Na public subdoméne middleware presmeruje `/` → `/sk` ešte pred touto stránkou (toto je poistka).
export default function RootPage() {
  const area = headers().get('x-area') ?? 'public';
  if (area === 'admin') redirect('/login');
  if (area === 'scanner') redirect('/scan');
  redirect('/sk');
}
