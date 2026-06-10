'use client';

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPrice } from '@/lib/format';
import { TopShow } from '@/lib/api/metrics';
import { EmptyState } from './parts';

const BAR_COLORS = ['#10B981', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7'];

interface Row {
  name: string;
  ticketsSold: number;
  revenue: number;
  organizerName: string;
}

function ShowTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-gray-900">{p.name}</div>
      <div className="text-gray-500">{p.organizerName}</div>
      <div className="mt-1 text-emerald-600">{p.ticketsSold} vstupeniek</div>
      <div className="text-gray-500">{formatPrice(p.revenue)}</div>
    </div>
  );
}

/** Skráti dlhý názov pre os Y. */
function truncate(s: string, n = 22): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function TopShowsChart({ data }: { data: TopShow[] }) {
  if (!data.length) {
    return <EmptyState message="Zatiaľ žiadne predané vstupenky." />;
  }

  const rows: Row[] = data.map((d) => ({
    name: truncate(d.title),
    ticketsSold: d.ticketsSold,
    revenue: d.revenue,
    organizerName: d.organizerName,
  }));

  return (
    <div className="w-full" style={{ height: Math.max(rows.length * 48, 96) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 12, fill: '#475569' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip cursor={{ fill: '#f8fafc' }} content={<ShowTooltip />} />
          <Bar dataKey="ticketsSold" radius={[0, 4, 4, 0]} barSize={20}>
            {rows.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
