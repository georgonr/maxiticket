'use client';

import { Accessibility } from 'lucide-react';
import { PublicSeatSection } from '@/lib/api';

// Úloha 22/3b: verejný výber sedadiel (SEATED sekcia). Klikateľné voľné sedadlá,
// obsadené sivé/disabled, vybrané zvýraznené. Read-only zoznam radov (bez zoom/pan –
// jednoduchšie a nižšie-rizikové než organizátorský SeatMapCanvas, ktorý ostáva nedotknutý).
interface Props {
  section: PublicSeatSection;
  selected: Set<string>;
  onToggle: (seatId: string) => void;
}

export function SeatPicker({ section, selected, onToggle }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      {/* pódium / orientácia */}
      <div className="mb-4 flex justify-center">
        <div className="rounded-full bg-slate-100 px-6 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Pódium / scéna
        </div>
      </div>

      <div className="space-y-1.5 overflow-x-auto">
        {section.rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-400">{row.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {row.seats.map((seat) => {
                const isSel = selected.has(seat.id);
                const base =
                  'flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-semibold transition-colors';
                const cls = seat.taken
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : isSel
                    ? 'bg-purple-700 text-white ring-2 ring-purple-300'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 cursor-pointer';
                return (
                  <button
                    key={seat.id}
                    type="button"
                    disabled={seat.taken}
                    onClick={() => onToggle(seat.id)}
                    title={`${section.name} · rad ${row.label} · sedadlo ${seat.label}${seat.isAccessible ? ' (bezbariérové)' : ''}${seat.taken ? ' – obsadené' : ''}`}
                    className={`${base} ${cls}`}
                  >
                    {seat.isAccessible ? <Accessibility size={12} /> : seat.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* legenda */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded-md border border-emerald-300 bg-emerald-50" /> voľné</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded-md bg-purple-700" /> vybrané</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded-md bg-slate-200" /> obsadené</span>
        <span className="flex items-center gap-1.5"><Accessibility size={13} /> bezbariérové</span>
      </div>
    </div>
  );
}
