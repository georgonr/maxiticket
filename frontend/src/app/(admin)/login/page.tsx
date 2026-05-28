import { LoginForm } from '@/components/auth/login-form';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Prihlásenie</h1>
          <p className="mt-1 text-sm text-gray-500">Maxiticket Admin portál</p>
        </div>
        <LoginForm />
        <p className="mt-5 text-center text-sm text-gray-500">
          Nemáte účet?{' '}
          <Link href="/register" className="text-brand hover:underline">
            Zaregistrujte sa
          </Link>
        </p>
      </div>
    </div>
  );
}
