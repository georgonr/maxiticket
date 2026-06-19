'use client';

/** iPhone-style prepínač (bežec zap/vyp). Bezstavový – riadený `checked` + `onChange`. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  size = 'md',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${w} flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${checked ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`inline-block ${knob} transform rounded-full bg-white shadow transition-transform ${checked ? shift : 'translate-x-0.5'}`} />
    </button>
  );
}
