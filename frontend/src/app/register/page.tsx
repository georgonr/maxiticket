import { headers } from 'next/headers';
import { AdminRegisterPage } from './AdminRegisterPage';
import { PublicRegisterPage } from './PublicRegisterPage';

export default function RegisterPage() {
  const area = headers().get('x-area') ?? 'public';
  if (area === 'admin') return <AdminRegisterPage />;
  return <PublicRegisterPage />;
}
