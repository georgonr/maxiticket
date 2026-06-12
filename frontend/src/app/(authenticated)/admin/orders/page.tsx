'use client';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { adminOrdersApi } from '@/lib/api/orders';

export default function AdminOrdersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Objednávky – všetci organizátori</h1>
          <p className="text-sm text-gray-500">Cross-organizer prehľad všetkých objednávok na platforme.</p>
        </div>
        <OrdersTable fetchList={adminOrdersApi.list} basePath="/admin/orders" isAdmin />
      </main>
    </div>
  );
}
