import { RegisterForm } from '@/components/auth/register-form';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Registrácia organizátora</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vytvorte si účet a začnite predávať vstupenky
          </p>
        </div>
        <RegisterForm />
        <p className="mt-5 text-center text-sm text-gray-500">
          Už máte účet?{' '}
          <Link href="/login" className="text-brand hover:underline">
            Prihláste sa
          </Link>
        </p>
      </div>
    </div>
  );
}
