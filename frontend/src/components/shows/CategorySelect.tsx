'use client';

import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { SHOW_CATEGORIES, isFixedCategory } from '@/lib/show-categories';

/**
 * Dropdown kategórie podujatia – pevný zoznam zo @/lib/show-categories.
 * Do DB ide kanonická hodnota (`value`), zobrazuje sa lokalizovaný label
 * z namespace `events` (cat.*), teda rovnaké kľúče ako filter na /events.
 *
 * Stavia na components/ui/select.tsx, takže vyzerá rovnako ako ostatné
 * rozbaľovačky vo formulári (napr. status podujatia) vrátane coral focus ringu.
 */
export function CategorySelect({
  id = 'category',
  label,
  placeholder,
  invalidSuffix,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  placeholder: string;
  /** Značka pri starej hodnote mimo zoznamu, napr. „(neplatná)". */
  invalidSuffix: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  const tc = useTranslations('events');

  // Stará voľnotextová hodnota (pred migráciou) – ponúkneme ju označenú,
  // aby sa pri otvorení editu potichu neprepísala na prázdnu.
  const legacy = value && !isFixedCategory(value) ? value : null;

  const options = [
    { value: '', label: placeholder },
    ...(legacy ? [{ value: legacy, label: `${legacy} ${invalidSuffix}` }] : []),
    ...SHOW_CATEGORIES.map(({ value: v, labelKey }) => ({ value: v, label: tc(labelKey) })),
  ];

  return (
    <Select
      id={id}
      label={label}
      value={value ?? ''}
      options={options}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
