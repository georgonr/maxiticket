'use client';

import { useParams } from 'next/navigation';
import { OrderDetailPanel } from '@/components/orders/OrderDetailPanel';
import { adminOrdersApi } from '@/lib/api/orders';

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <OrderDetailPanel id={id} fetchOrder={adminOrdersApi.get} backHref="/admin/orders" resend={adminOrdersApi.resend} />
    </div>
  );
}
