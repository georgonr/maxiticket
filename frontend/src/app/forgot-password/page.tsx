import { headers } from 'next/headers';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  const area = headers().get('x-area') ?? 'public';
  return <ForgotPasswordForm isAdmin={area === 'admin'} />;
}
