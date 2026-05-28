import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Root "/" – redirect based on area detected by middleware
export default function RootPage() {
  const area = headers().get('x-area') ?? 'public';
  if (area === 'admin') redirect('/login');
  if (area === 'scanner') redirect('/scan');
  // public area → events listing
  redirect('/events');
}
