import { headers } from 'next/headers';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordPage() {
  const area = headers().get('x-area') ?? 'public';
  return <ResetPasswordForm isAdmin={area === 'admin'} />;
}
