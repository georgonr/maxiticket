'use client';

import { useState } from 'react';
import type { CouponType, CouponScope, CouponBaseInput } from '@/lib/api/coupons';
import { Field, inputCls } from './couponUi';

export interface FlatTicketType {
  id: string;
  label: string;
}

const TYPE_OPTIONS: { value: CouponType; label: string }[] = [
  { value: 'PERCENTAGE', label: 'Percentuálna zľava' },
  { value: 'FIXED_AMOUNT', label: 'Pevná suma (€)' },
  { value: 'FREE_TICKET', label: 'Vstupenka zdarma' },
];

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
 * Scope je v kontexte editora obmedzený na SHOW / TICKET_TYPE (kupón daného podujatia).
 */
export function useCouponFields(opts: { showId: string; ticketTypes: FlatTicketType[] }) {
  const { showId, ticketTypes } = opts;
  const [type, setType] = useState<CouponType>('PERCENTAGE');
  const [value, setValue] = useState('15');
  const [scope, setScope] = useState<CouponScope>('SHOW');
  const [ticketTypeId, setTicketTypeId] = useState('');
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
      if (n == null) throw new Error('Zadajte hodnotu zľavy.');
      if (type === 'PERCENTAGE' && (n <= 0 || n > 100)) {
        throw new Error('Percentuálna zľava musí byť 1–100.');
      }
      if (type === 'FIXED_AMOUNT' && n <= 0) throw new Error('Suma musí byť kladná.');
      val = n;
    }

    if (scope === 'TICKET_TYPE' && !ticketTypeId) {
      throw new Error('Pre scope „Typ lístka“ vyberte konkrétny typ lístka.');
    }

    const base: CouponBaseInput = { type, value: val, scope };
    if (scope === 'SHOW') base.showId = showId;
    if (scope === 'TICKET_TYPE') base.ticketTypeId = ticketTypeId;

    const vf = toIso(validFrom);
    const vu = toIso(validUntil);
    if (vf && vu && new Date(vf) > new Date(vu)) {
      throw new Error('„Platnosť od“ nemôže byť po „Platnosť do“.');
    }
    if (vf) base.validFrom = vf;
    if (vu) base.validUntil = vu;

    const mu = num(maxUses);
    if (mu != null) {
      if (mu < 1) throw new Error('Max. použití musí byť aspoň 1.');
      base.maxUses = Math.floor(mu);
    }
    const mupu = num(maxUsesPerUser);
    if (mupu != null) {
      if (mupu < 1) throw new Error('Max. na používateľa musí byť aspoň 1.');
      base.maxUsesPerUser = Math.floor(mupu);
    }
    const moa = num(minOrderAmount);
    if (moa != null) {
      if (moa < 0) throw new Error('Min. suma objednávky nemôže byť záporná.');
      base.minOrderAmount = moa;
    }
    return base;
  }

  const node = (
    <div className="space-y-4">
      <Field label="Typ zľavy">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CouponType)}
          className={inputCls}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={type === 'PERCENTAGE' ? 'Hodnota (%)' : type === 'FIXED_AMOUNT' ? 'Hodnota (€)' : 'Hodnota'}
      >
        <input
          type="number"
          value={isFree ? 100 : value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isFree}
          min={type === 'PERCENTAGE' ? 1 : 0}
          max={type === 'PERCENTAGE' ? 100 : undefined}
          className={inputCls + (isFree ? ' bg-gray-50 text-gray-400' : '')}
          placeholder={type === 'PERCENTAGE' ? 'napr. 15' : 'napr. 5'}
        />
      </Field>

      <Field label="Rozsah platnosti">
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <input
              type="radio"
              name="coupon-scope"
              checked={scope === 'SHOW'}
              onChange={() => setScope('SHOW')}
              className="accent-brand"
            />
            Celé podujatie
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <input
              type="radio"
              name="coupon-scope"
              checked={scope === 'TICKET_TYPE'}
              onChange={() => setScope('TICKET_TYPE')}
              className="accent-brand"
            />
            Typ lístka
          </label>
        </div>
      </Field>

      {scope === 'TICKET_TYPE' && (
        <Field label="Typ lístka">
          <select
            value={ticketTypeId}
            onChange={(e) => setTicketTypeId(e.target.value)}
            className={inputCls}
          >
            <option value="">— vyberte —</option>
            {ticketTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Platnosť od">
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Platnosť do">
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Max. použití" hint="prázdne = ∞">
          <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={inputCls} placeholder="∞" />
        </Field>
        <Field label="Max. na používateľa" hint="prázdne = ∞">
          <input type="number" min={1} value={maxUsesPerUser} onChange={(e) => setMaxUsesPerUser(e.target.value)} className={inputCls} placeholder="∞" />
        </Field>
      </div>

      <Field label="Min. suma objednávky (€)" hint="voliteľné">
        <input type="number" min={0} step="0.01" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} className={inputCls} placeholder="bez limitu" />
      </Field>
    </div>
  );

  return { node, buildBase };
}
