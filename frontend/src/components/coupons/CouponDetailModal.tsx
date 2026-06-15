'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getValidToken } from '@/lib/auth';
import { couponsAdminApi, CouponDetail } from '@/lib/api/coupons';
import {
  ModalShell,
  ScopeBadge,
  StatusBadge,
  useCouponLabels,
} from './couponUi';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  );
}

export function CouponDetailModal({ couponId, onClose }: { couponId: string; onClose: () => void }) {
  const t = useTranslations('organizer.coupon');
  const { typeValueLabel, usageLabel, validityLabel, fmtPrice } = useCouponLabels();
  const [coupon, setCoupon] = useState<CouponDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getValidToken().then(async (token) => {
      if (!token) {
        if (active) setError(t('errors.loginRequired'));
        return;
      }
      try {
        const data = await couponsAdminApi.get(couponId, token);
        if (active) setCoupon(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : t('errors.loadFailed'));
      }
    });
    return () => {
      active = false;
    };
  }, [couponId, t]);

  return (
    <ModalShell title={t('detailTitle')} onClose={onClose}>
      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : !coupon ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-brand" size={28} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">{coupon.code}</span>
            <StatusBadge status={coupon.status} />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            <Row label={t('rows.discount')} value={typeValueLabel(coupon.type, coupon.value)} />
            <Row label={t('rows.scope')} value={<ScopeBadge scope={coupon.scope} />} />
            {coupon.scopeTargetName && <Row label={t('rows.appliesTo')} value={coupon.scopeTargetName} />}
            <Row label={t('rows.validity')} value={validityLabel(coupon.validFrom, coupon.validUntil)} />
            <Row label={t('rows.usage')} value={usageLabel(coupon.usedCount, coupon.maxUses)} />
            <Row label={t('rows.maxPerUser')} value={coupon.maxUsesPerUser ?? '∞'} />
            <Row
              label={t('rows.minOrderAmount')}
              value={coupon.minOrderAmount != null ? fmtPrice(coupon.minOrderAmount) : '—'}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">{t('recentRedemptions')}</p>
            {coupon.redemptions.length === 0 ? (
              <p className="rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-400 dark:text-gray-500">{t('notUsedYet')}</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {coupon.redemptions.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{r.orderNumber}</span>
                      {r.userEmail && <span className="ml-2 text-gray-400 dark:text-gray-500">{r.userEmail}</span>}
                    </div>
                    <span className="text-gray-600 dark:text-gray-300">−{fmtPrice(r.discountAmount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
