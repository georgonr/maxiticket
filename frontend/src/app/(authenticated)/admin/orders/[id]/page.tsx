'use client';

import { useParams } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { OrderDetailPanel } from '@/components/orders/OrderDetailPanel';
import { adminOrdersApi } from '@/lib/api/orders';

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <OrderDetailPanel id={id} fetchOrder={adminOrdersApi.get} backHref="/admin/orders" />
    </div>
  );
}
