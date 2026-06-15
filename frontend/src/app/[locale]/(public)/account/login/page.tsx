import { redirect } from 'next/navigation';

// Alias: customer login is unified under /login (role-based redirect sends
// CUSTOMER → /account after success). Forward the original ?next= / ?reset=
// so flows like checkout (?next=/checkout) and post-reset banners keep working.
export default function AccountLoginAlias({
  searchParams,
}: {
  searchParams: { next?: string; reset?: string };
}) {
  const next = searchParams.next ?? '/account/tickets';
  const reset = searchParams.reset ? '&reset=1' : '';
  redirect(`/login?next=${encodeURIComponent(next)}${reset}`);
}
