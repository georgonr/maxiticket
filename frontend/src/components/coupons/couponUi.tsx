'use client';

import { ReactNode, useEffect } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { useTranslations, useFormatter } from 'next-intl';
import type {
  CouponType,
  CouponScope,
  CouponStatus,
} from '@/lib/api/coupons';

// ── Labels ──────────────────────────────────────────────────────────────────

const SCOPE_CLS: Record<CouponScope, string> = {
  GLOBAL: 'bg-purple-50 text-purple-700',
  ORGANIZER: 'bg-indigo-50 text-indigo-700',
  SHOW: 'bg-sky-50 text-sky-700',
  TICKET_TYPE: 'bg-teal-50 text-teal-700',
};

const STATUS_CLS: Record<CouponStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-blue-50 text-blue-700',
  expired: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  exhausted: 'bg-orange-50 text-orange-700',
};

/**
 * Locale-aware label helpers pre kupóny. Hook (nie module-level konštanty),
 * aby sa dali použiť useTranslations/useFormatter.
 */
export function useCouponLabels() {
  const t = useTranslations('organizer.coupon');
  const format = useFormatter();

  const fmtPrice = (amount: number) =>
    format.number(amount, { style: 'currency', currency: 'EUR' });

  const fmtShortDate = (s: string) =>
    format.dateTime(new Date(s), { day: 'numeric', month: 'numeric', year: '2-digit' });

  const typeValueLabel = (type: CouponType, value: number): string => {
    if (type === 'PERCENTAGE') return `${value} %`;
    if (type === 'FIXED_AMOUNT') return fmtPrice(value);
    return t('type.FREE_TICKET_value');
  };

  const usageLabel = (usedCount: number, maxUses: number | null): string =>
    `${usedCount}/${maxUses ?? '∞'}`;

  const validityLabel = (validFrom: string | null, validUntil: string | null): string => {
    if (!validFrom && !validUntil) return t('validity.unlimited');
    if (validFrom && validUntil) return `${fmtShortDate(validFrom)} – ${fmtShortDate(validUntil)}`;
    if (validUntil) return t('validity.until', { date: fmtShortDate(validUntil) });
    return t('validity.from', { date: fmtShortDate(validFrom as string) });
  };

  return { typeValueLabel, usageLabel, validityLabel, fmtPrice };
}

export function ScopeBadge({ scope, inherited }: { scope: CouponScope; inherited?: boolean }) {
  const t = useTranslations('organizer.coupon');
  return (
    <span className="inline-flex items-center gap-1">
      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', SCOPE_CLS[scope])}>
        {t(`scope.${scope}`)}
      </span>
      {inherited && (
        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {t('inherited')}
        </span>
      )}
    </span>
  );
}

export function StatusBadge({ status }: { status: CouponStatus }) {
  const t = useTranslations('organizer.coupon');
  const cls = STATUS_CLS[status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
  const label = STATUS_CLS[status] ? t(`status.${status}`) : status;
  return (
    <span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  );
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
  const t = useTranslations('organizer.coupon');
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
            aria-label={t('close')}
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
