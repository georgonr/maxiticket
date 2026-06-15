'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Tag, X, Loader2, Check } from 'lucide-react';
import { couponsApi, ValidateCouponItem } from '@/lib/api/coupons';

export interface AppliedCoupon {
  code: string;
  couponId: string;
  type: string;
  scope: string;
  discount: number;
  finalAmount: number;
}

interface Props {
  subtotal: number;
  items: ValidateCouponItem[];
  currency?: string;
  userId?: string;
  appliedCoupon: AppliedCoupon | null;
  onApply: (c: AppliedCoupon) => void;
  onRemove: () => void;
}

export function CouponInput({
  subtotal,
  items,
  currency = 'EUR',
  userId,
  appliedCoupon,
  onApply,
  onRemove,
}: Props) {
  const t = useTranslations('coupon');
  const format = useFormatter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);
    try {
      const result = await couponsApi.validate({ code: trimmed, subtotal, items, userId });
      if (result.valid) {
        onApply({
          code: trimmed.toUpperCase(),
          couponId: result.couponId,
          type: result.type,
          scope: result.scope,
          discount: result.discount,
          finalAmount: result.finalAmount,
        });
        setCode('');
      } else {
        setError(result.reason);
      }
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  }

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Check size={16} className="text-emerald-600" />
          <span className="font-medium text-emerald-800">{appliedCoupon.code}</span>
          <span className="text-emerald-700">
            −{format.number(appliedCoupon.discount, { style: 'currency', currency })}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
        >
          <X size={14} />
          {t('remove')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Tag
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApply();
              }
            }}
            placeholder={t('placeholder')}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm uppercase placeholder:normal-case focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            disabled={loading}
          />
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : t('apply')}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
