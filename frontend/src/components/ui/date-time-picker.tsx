'use client';

interface DateTimePickerProps {
  id: string;
  label: string;
  value: string; // "YYYY-MM-DDTHH:mm" or ""
  onChange: (value: string) => void;
  required?: boolean;
  showQuickButtons?: boolean;
  disabled?: boolean;
}

export function DateTimePicker({
  id,
  label,
  value,
  onChange,
  required,
  showQuickButtons = false,
  disabled = false,
}: DateTimePickerProps) {
  const parts = value ? value.split('T') : ['', ''];
  const datePart = parts[0] ?? '';
  const timePart = parts[1] ?? '';

  function emit(d: string, t: string) {
    if (!d && !t) { onChange(''); return; }
    onChange(`${d || todayIso()}T${t || '00:00'}`);
  }

  function todayIso() {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  }

  function pad(n: number) { return String(n).padStart(2, '0'); }

  function setToday() {
    emit(todayIso(), timePart);
  }

  function setNow() {
    const n = new Date();
    emit(todayIso(), `${pad(n.getHours())}:${pad(n.getMinutes())}`);
  }

  const base =
    'block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm ' +
    'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`${id}-date`}
          type="date"
          value={datePart}
          onChange={(e) => emit(e.target.value, timePart)}
          required={required}
          disabled={disabled}
          className={`${base} ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
        />
        <input
          id={`${id}-time`}
          type="time"
          value={timePart}
          onChange={(e) => emit(datePart, e.target.value)}
          disabled={disabled}
          className={`${base} w-28 ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
        />
        {showQuickButtons && !disabled && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={setToday}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 active:bg-gray-100"
            >
              Dnes
            </button>
            <button
              type="button"
              onClick={setNow}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 active:bg-gray-100"
            >
              Teraz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
