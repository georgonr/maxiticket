'use client';

import { ReactNode, useEffect } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import type {
  CouponType,
  CouponScope,
  CouponStatus,
} from '@/lib/api/coupons';

// ── Labels ──────────────────────────────────────────────────────────────────

export function typeValueLabel(type: CouponType, value: number): string {
  if (type === 'PERCENTAGE') return `${value} %`;
  if (type === 'FIXED_AMOUNT') return formatPrice(value);
  return 'Zdarma';
}

const SCOPE_META: Record<CouponScope, { label: string; cls: string }> = {
  GLOBAL: { label: 'Globálny', cls: 'bg-purple-50 text-purple-700' },
  ORGANIZER: { label: 'Organizátor', cls: 'bg-indigo-50 text-indigo-700' },
  SHOW: { label: 'Podujatie', cls: 'bg-sky-50 text-sky-700' },
  TICKET_TYPE: { label: 'Typ lístka', cls: 'bg-teal-50 text-teal-700' },
};

export function ScopeBadge({ scope, inherited }: { scope: CouponScope; inherited?: boolean }) {
  const m = SCOPE_META[scope];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', m.cls)}>{m.label}</span>
      {inherited && (
        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
          dedené
        </span>
      )}
    </span>
  );
}

const STATUS_META: Record<CouponStatus, { label: string; cls: string }> = {
  active: { label: 'Aktívny', cls: 'bg-emerald-50 text-emerald-700' },
  scheduled: { label: 'Naplánovaný', cls: 'bg-blue-50 text-blue-700' },
  expired: { label: 'Expirovaný', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
  exhausted: { label: 'Vyčerpaný', cls: 'bg-orange-50 text-orange-700' },
};

export function StatusBadge({ status }: { status: CouponStatus }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' };
  return (
    <span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', m.cls)}>
      {m.label}
    </span>
  );
}

export function usageLabel(usedCount: number, maxUses: number | null): string {
  return `${usedCount}/${maxUses ?? '∞'}`;
}

export function validityLabel(validFrom: string | null, validUntil: string | null): string {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: '2-digit' }).format(
      new Date(s),
    );
  if (!validFrom && !validUntil) return 'Bez obmedzenia';
  if (validFrom && validUntil) return `${fmt(validFrom)} – ${fmt(validUntil)}`;
  if (validUntil) return `do ${fmt(validUntil)}`;
  return `od ${fmt(validFrom as string)}`;
}

// ── Modal shell (projektový pattern: fixed inset-0, bez externej knižnice) ─────

export function ModalShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600"
            aria-label="Zavrieť"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

// ── Form primitives ───────────────────────────────────────────────────────────

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';
