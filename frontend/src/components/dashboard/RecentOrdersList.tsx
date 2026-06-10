'use client';

import { formatPrice } from '@/lib/format';
import { RecentOrder } from '@/lib/api/metrics';
import { OrderStatusBadge, EmptyState, formatDateTime } from './parts';

export function RecentOrdersList({ orders }: { orders: RecentOrder[] }) {
  if (!orders.length) {
    return <EmptyState message="Zatiaľ žiadne objednávky." />;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {orders.map((o) => (
        <li key={o.orderId} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-gray-900">
                {o.buyerName || o.buyerEmail}
              </span>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="truncate text-xs text-gray-500">
              {o.orderNumber}
              {o.showTitle ? ` · ${o.showTitle}` : ''}
              {o.ticketCount ? ` · ${o.ticketCount} ks` : ''}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-sm font-semibold tabular-nums text-gray-900">
              {formatPrice(o.totalAmount)}
            </div>
            <div className="text-xs text-gray-400">{formatDateTime(o.createdAt)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
