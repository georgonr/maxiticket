'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { setAccessToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { getReadableError } from '@/lib/api-errors';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';

type Fields = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  acceptTerms: true;
};

function RegisterContent() {
  const t = useTranslations('accountSettings');
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/account/tickets';
  const { refresh } = usePublicAuth();
  const [serverError, setServerError] = useState('');
  const schema = z.object({
    firstName: z.string().min(2, t('validationMin2')),
    lastName: z.string().min(2, t('validationMin2')),
    email: z.string().email(t('validationEmail')),
    password: z.string().min(8, t('validationMin8')),
    phone: z.string().optional(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: t('validationAcceptTerms') }) }),
  });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Fields>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: Fields) {
    setServerError('');
    try {
      const res = await fetch('/api/auth/register-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(getReadableError({ endpoint: 'register-customer', status: res.status, code: json.message }));
        return;
      }
      setAccessToken(json.accessToken);
      await refresh();
      router.push(next);
    } catch {
      setServerError(getReadableError({ endpoint: 'register-customer' }));
    }
  }

  return (
    <div className="flex min-h-[72vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-700 shadow-lg">
            <span className="text-lg font-extrabold text-white">MT</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('registerTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('registerSubtitle')}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Input id="firstName" label={t('firstNameLabel')} error={errors.firstName?.message} {...register('firstName')} />
              <Input id="lastName" label={t('lastNameLabel')} error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <Input
              id="email"
              label={t('emailLabel')}
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <PasswordInput
              id="password"
              label={t('passwordLabel')}
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              id="phone"
              label={t('phoneOptionalLabel')}
              type="tel"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <label className="mt-1 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-purple-700"
                {...register('acceptTerms')}
              />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {t.rich('acceptTermsLabel', {
                  terms: (chunks) => (
                    <NextLink href="#" className="font-medium text-purple-700 hover:underline">
                      {chunks}
                    </NextLink>
                  ),
                })}
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="text-xs text-red-600">{errors.acceptTerms.message}</p>
            )}

            {serverError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <Button type="submit" size="lg" loading={isSubmitting} className="w-full mt-1">
              {t('submitButton')}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('haveAccount')}{' '}
          <Link
            href={`/account/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-purple-700 hover:text-purple-600 hover:underline transition-colors"
          >
            {t('loginLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
