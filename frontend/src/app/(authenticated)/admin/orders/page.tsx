'use client';

import { useTranslations } from 'next-intl';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { adminOrdersApi } from '@/lib/api/orders';

export default function AdminOrdersPage() {
  const t = useTranslations('admin');
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('orders.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('orders.subtitle')}</p>
        </div>
        <OrdersTable fetchList={adminOrdersApi.list} basePath="/admin/orders" isAdmin />
      </main>
    </div>
  );
}
