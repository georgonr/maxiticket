'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ── pozdrav podľa hodiny ──────────────────────────────────────────────────────

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Dobré ráno';
  if (h < 18) return 'Dobré popoludnie';
  return 'Dobrý večer';
}

/** 'YYYY-MM-DD' → 'dd.MM' (UTC, aby nedošlo k posunu o deň). */
export function formatDayShort(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return new Intl.DateTimeFormat('sk-SK', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(d);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bratislava',
  }).format(new Date(iso));
}

// ── KPI karta ─────────────────────────────────────────────────────────────────

export function KpiCard({
  title,
  value,
  icon,
  change,
  hint,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  change?: number; // signed %
  hint?: string;
}) {
  const hasChange = typeof change === 'number';
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
        <span className="text-brand">{icon}</span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900 tabular-nums dark:text-gray-100">{value}</span>
        {hasChange && (
          <span
            className={clsx(
              'mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
              up ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

// ── obal sekcie s nadpisom + voliteľný "Všetky" link ───────────────────────────

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── stavové badge pre objednávky ───────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Zaplatené', cls: 'bg-emerald-50 text-emerald-700' },
  PENDING: { label: 'Čaká', cls: 'bg-amber-50 text-amber-700' },
  REFUND_REQUESTED: { label: 'Žiadosť o vrátenie', cls: 'bg-amber-50 text-amber-700' },
  REFUND_APPROVED: { label: 'Vrátenie schválené', cls: 'bg-sky-50 text-sky-700' },
  REFUND_REJECTED: { label: 'Vrátenie zamietnuté', cls: 'bg-gray-100 text-gray-500' },
  REFUNDED: { label: 'Refundované', cls: 'bg-orange-50 text-orange-700' },
  CANCELLED: { label: 'Zrušené', cls: 'bg-gray-100 text-gray-500' },
  FAILED: { label: 'Zlyhalo', cls: 'bg-red-50 text-red-700' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>
      {s.label}
    </span>
  );
}

// ── loading / empty / error stavy ──────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-gray-100 dark:bg-gray-800', className)} />;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-8 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      {message}
    </div>
  );
}
