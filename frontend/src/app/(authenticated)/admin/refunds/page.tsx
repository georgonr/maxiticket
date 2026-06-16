'use client';

import { useTranslations } from 'next-intl';
import { RefundsManager } from '@/components/refunds/RefundsManager';

export default function AdminRefundsPage() {
  const t = useTranslations('admin');
  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('refunds.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('refunds.subtitle')}</p>
        </div>
        <RefundsManager admin />
      </main>
    </div>
  );
}
