import { AdminRegisterPage } from '../AdminRegisterPage';

// Interná route pre organizer signup (UX-FIX-2).
// Predtým viedlo tlačidlo na admin.ticketall.eu/register, ktoré Caddy 301-redirectuje
// späť na ticketall.eu/register → výberový screen (x-area='admin' vetva je mŕtva,
// admin subdoména už neservíruje frontend). Táto route renderuje organizer formulár
// (RegisterForm) priamo na hlavnej doméne bez závislosti na subdoméne/x-area.
export const metadata = {
  title: 'Registrácia organizátora — TicketAll',
};

export default function RegisterOrganizerPage() {
  return <AdminRegisterPage />;
}
