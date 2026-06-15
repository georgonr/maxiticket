'use client';

import { useTranslations } from 'next-intl';
import { RefundsManager } from '@/components/refunds/RefundsManager';

export default function OrganizerRefundsPage() {
  const t = useTranslations('organizer.refunds');
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <RefundsManager admin={false} />
      </main>
    </div>
  );
}
