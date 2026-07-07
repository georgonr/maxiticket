'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CouponType, CouponBaseInput } from '@/lib/api/coupons';
import { Field, inputCls } from './couponUi';

export interface FlatTicketType {
  id: string;
  label: string;
}

const TYPE_VALUES: CouponType[] = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_TICKET'];

/** Číslo z text inputu alebo undefined ak prázdne. */
function num(v: string): number | undefined {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Date input (YYYY-MM-DD) → ISO 8601, alebo undefined. */
function toIso(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Zdieľané polia kupónu pre Create + Bulk modaly.
 * Scope je natvrdo SHOW – kupón je vždy viazaný na aktuálne podujatie
 * (žiadny GLOBAL/ORGANIZER/TICKET_TYPE; vynucuje aj backend).
 */
export function useCouponFields(opts: { showId: string; ticketTypes: FlatTicketType[] }) {
  const { showId } = opts;
  const t = useTranslations('organizer.coupon');
  const [type, setType] = useState<CouponType>('PERCENTAGE');
  const [value, setValue] = useState('15');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');

  const isFree = type === 'FREE_TICKET';

  /** Zostaví spoločnú časť payloadu alebo vyhodí Error s chybovou hláškou. */
  function buildBase(): CouponBaseInput {
    let val: number;
    if (isFree) {
      val = 100;
    } else {
      const n = num(value);
      if (n == null) throw new Error(t('errors.valueRequired'));
      if (type === 'PERCENTAGE' && (n < 0 || n > 100)) {
        throw new Error(t('errors.percentRange'));
      }
      if (type === 'FIXED_AMOUNT' && n <= 0) throw new Error(t('errors.amountPositive'));
      val = n;
    }

    // Scope je vždy SHOW viazaný na aktuálne podujatie (bezpečnostné pravidlo).
    const base: CouponBaseInput = { type, value: val, scope: 'SHOW', showId };

    const vf = toIso(validFrom);
    const vu = toIso(validUntil);
    if (vf && vu && new Date(vf) > new Date(vu)) {
      throw new Error(t('errors.validFromAfterUntil'));
    }
    if (vf) base.validFrom = vf;
    if (vu) base.validUntil = vu;

    const mu = num(maxUses);
    if (mu != null) {
      if (mu < 1) throw new Error(t('errors.maxUsesMin'));
      base.maxUses = Math.floor(mu);
    }
    const mupu = num(maxUsesPerUser);
    if (mupu != null) {
      if (mupu < 1) throw new Error(t('errors.maxUsesPerUserMin'));
      base.maxUsesPerUser = Math.floor(mupu);
    }
    const moa = num(minOrderAmount);
    if (moa != null) {
      if (moa < 0) throw new Error(t('errors.minOrderNegative'));
      base.minOrderAmount = moa;
    }
    return base;
  }

  const node = (
    <div className="space-y-4">
      <Field label={t('fields.type')}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CouponType)}
          className={inputCls}
        >
          {TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`type.${v}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={type === 'PERCENTAGE' ? t('fields.valuePercent') : type === 'FIXED_AMOUNT' ? t('fields.valueAmount') : t('fields.value')}
      >
        <input
          type="number"
          value={isFree ? 100 : value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isFree}
          min={type === 'PERCENTAGE' ? 0 : 1}
          max={type === 'PERCENTAGE' ? 100 : undefined}
          className={inputCls + (isFree ? ' bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500' : '')}
          placeholder={type === 'PERCENTAGE' ? t('placeholders.valuePercent') : t('placeholders.valueAmount')}
        />
      </Field>
      {type === 'PERCENTAGE' && (
        <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">{t('hints.trackingZero')}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('fields.validFrom')}>
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
        </Field>
        <Field label={t('fields.validUntil')}>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('fields.maxUses')} hint={t('hints.emptyInfinite')}>
          <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={inputCls} placeholder="∞" />
        </Field>
        <Field label={t('fields.maxUsesPerUser')} hint={t('hints.emptyInfinite')}>
          <input type="number" min={1} value={maxUsesPerUser} onChange={(e) => setMaxUsesPerUser(e.target.value)} className={inputCls} placeholder="∞" />
        </Field>
      </div>

      <Field label={t('fields.minOrderAmount')} hint={t('hints.optional')}>
        <input type="number" min={0} step="0.01" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} className={inputCls} placeholder={t('placeholders.noLimit')} />
      </Field>
    </div>
  );

  return { node, buildBase };
}
