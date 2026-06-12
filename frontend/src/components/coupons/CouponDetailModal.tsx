'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { couponsAdminApi, CouponDetail } from '@/lib/api/coupons';
import { formatPrice } from '@/lib/format';
import {
  ModalShell,
  ScopeBadge,
  StatusBadge,
  typeValueLabel,
  usageLabel,
  validityLabel,
} from './couponUi';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-800">{value}</span>
    </div>
  );
}

export function CouponDetailModal({ couponId, onClose }: { couponId: string; onClose: () => void }) {
  const [coupon, setCoupon] = useState<CouponDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getValidToken().then(async (token) => {
      if (!token) {
        if (active) setError('Vyžaduje sa prihlásenie.');
        return;
      }
      try {
        const data = await couponsAdminApi.get(couponId, token);
        if (active) setCoupon(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Načítanie zlyhalo.');
      }
    });
    return () => {
      active = false;
    };
  }, [couponId]);

  return (
    <ModalShell title="Detail kupónu" onClose={onClose}>
      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : !coupon ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-brand" size={28} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg font-semibold text-gray-900">{coupon.code}</span>
            <StatusBadge status={coupon.status} />
          </div>
          <div className="divide-y divide-gray-50">
            <Row label="Zľava" value={typeValueLabel(coupon.type, coupon.value)} />
            <Row label="Rozsah" value={<ScopeBadge scope={coupon.scope} />} />
            {coupon.scopeTargetName && <Row label="Platí pre" value={coupon.scopeTargetName} />}
            <Row label="Platnosť" value={validityLabel(coupon.validFrom, coupon.validUntil)} />
            <Row label="Použitia" value={usageLabel(coupon.usedCount, coupon.maxUses)} />
            <Row label="Max. na používateľa" value={coupon.maxUsesPerUser ?? '∞'} />
            <Row
              label="Min. suma objednávky"
              value={coupon.minOrderAmount != null ? formatPrice(coupon.minOrderAmount) : '—'}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Posledné použitia</p>
            {coupon.redemptions.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-400">Zatiaľ nepoužitý</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {coupon.redemptions.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{r.orderNumber}</span>
                      {r.userEmail && <span className="ml-2 text-gray-400">{r.userEmail}</span>}
                    </div>
                    <span className="text-gray-600">−{formatPrice(r.discountAmount)}</span>
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
