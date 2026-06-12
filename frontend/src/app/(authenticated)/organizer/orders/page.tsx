'use client';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { organizerOrdersApi } from '@/lib/api/orders';

export default function OrganizerOrdersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Objednávky</h1>
          <p className="text-sm text-gray-500">Prehľad objednávok vašich podujatí.</p>
        </div>
        <OrdersTable fetchList={organizerOrdersApi.list} basePath="/organizer/orders" />
      </main>
    </div>
  );
}
