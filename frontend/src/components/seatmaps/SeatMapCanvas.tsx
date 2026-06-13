'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Accessibility } from 'lucide-react';
import { Section, SECTION_COLORS } from '@/lib/api/seatmaps';

// Layout konštanty (deterministický auto-layout, NEpersistuje pozície – Fáza 2b)
const SEAT_R = 9;
const SEAT_PITCH = 23;
const ROW_PITCH = 23;
const ROW_LABEL_W = 26;
const SEC_PAD = 16;
const SEC_HEADER = 30;
const SEC_GAP = 28;
const SECTIONED_H = 74;
// nad týmto počtom sedadiel v sekcii renderujeme zjednodušený blok (výkon)
const SEAT_RENDER_CAP = 600;

interface Box {
  section: Section;
  x: number;
  y: number;
  w: number;
  h: number;
  simplified: boolean;
}

function colorFor(s: Section, idx: number): string {
  return s.color ?? SECTION_COLORS[idx % SECTION_COLORS.length];
}

function layout(sections: Section[]): { boxes: Box[]; width: number; height: number } {
  const ordered = [...sections].sort((a, b) => a.displayOrder - b.displayOrder);
  const boxes: Box[] = [];
  let cy = 0;
  let maxW = 0;
  for (const s of ordered) {
    let w: number, h: number, simplified = false;
    if (s.mode === 'SECTIONED') {
      const cap = s.capacity ?? 0;
      w = Math.min(520, Math.max(170, Math.round(Math.sqrt(Math.max(cap, 1)) * 26)));
      h = SECTIONED_H;
    } else {
      const seatCount = s.rows.reduce((sum, r) => sum + r.seats.length, 0);
      const maxSeats = s.rows.reduce((m, r) => Math.max(m, r.seats.length), 0);
      simplified = seatCount > SEAT_RENDER_CAP;
      w = Math.max(200, ROW_LABEL_W + SEC_PAD * 2 + maxSeats * SEAT_PITCH);
      h = simplified ? SECTIONED_H : SEC_HEADER + SEC_PAD + s.rows.length * ROW_PITCH + SEC_PAD;
    }
    boxes.push({ section: s, x: 0, y: cy, w, h, simplified });
    cy += h + SEC_GAP;
    maxW = Math.max(maxW, w);
  }
  return { boxes, width: maxW, height: Math.max(cy - SEC_GAP, 0) };
}

export function SeatMapCanvas({ sections }: { sections: Section[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(20);
  const [ty, setTy] = useState(20);
  const [hover, setHover] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const { boxes, width, height } = useMemo(() => layout(sections), [sections]);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el || width === 0 || height === 0) {
      setScale(1); setTx(20); setTy(20);
      return;
    }
    const cw = el.clientWidth - 40;
    const ch = el.clientHeight - 40;
    const s = Math.max(0.3, Math.min(3, Math.min(cw / width, ch / height)));
    setScale(s);
    setTx((el.clientWidth - width * s) / 2);
    setTy(Math.max(20, (el.clientHeight - height * s) / 2));
  }, [width, height]);

  // fit pri prvom vykreslení a zmene obsahu
  useEffect(() => { fit(); }, [fit]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale((prev) => {
      const next = Math.max(0.3, Math.min(3, prev * factor));
      const k = next / prev;
      // zoom okolo kurzora
      setTx((t) => mx - (mx - t) * k);
      setTy((t) => my - (my - t) * k);
      return next;
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    // pan len ťahaním pozadia (nie sedadla – tie majú stopPropagation? necháme pan vždy)
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setTx(d.tx + (e.clientX - d.x));
    setTy(d.ty + (e.clientY - d.y));
  };
  const endDrag = () => { dragRef.current = null; };

  const zoomBtn = (dir: 1 | -1) =>
    setScale((p) => Math.max(0.3, Math.min(3, p * (dir > 0 ? 1.2 : 1 / 1.2))));

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
      {/* ovládače */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <button onClick={() => zoomBtn(1)} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800" aria-label="Priblížiť"><ZoomIn size={16} /></button>
        <button onClick={() => zoomBtn(-1)} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800" aria-label="Oddialiť"><ZoomOut size={16} /></button>
        <button onClick={fit} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800" aria-label="Vycentrovať"><Maximize2 size={16} /></button>
      </div>

      {/* hover label */}
      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-gray-900/90 px-2.5 py-1 text-xs font-medium text-white shadow">
          {hover}
        </div>
      )}

      <div
        ref={wrapRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <svg className="h-full w-full select-none" role="img" aria-label="Náhľad plánu haly">
          <g transform={`translate(${tx},${ty}) scale(${scale})`}>
            {boxes.map((box, idx) => {
              const c = colorFor(box.section, idx);
              return (
                <g key={box.section.id} transform={`translate(${box.x},${box.y})`}>
                  {box.section.mode === 'SECTIONED' ? (
                    <>
                      <rect width={box.w} height={box.h} rx={12} fill={c} fillOpacity={0.14} stroke={c} strokeWidth={2} />
                      <text x={box.w / 2} y={box.h / 2 - 6} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100" style={{ fontSize: 15, fontWeight: 700 }}>{box.section.name}</text>
                      <text x={box.w / 2} y={box.h / 2 + 14} textAnchor="middle" fill={c} style={{ fontSize: 12, fontWeight: 600 }}>kapacita: {box.section.capacity ?? 0}</text>
                    </>
                  ) : box.simplified ? (
                    <>
                      <rect width={box.w} height={box.h} rx={12} fill={c} fillOpacity={0.14} stroke={c} strokeWidth={2} strokeDasharray="6 4" />
                      <text x={box.w / 2} y={box.h / 2 - 6} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100" style={{ fontSize: 15, fontWeight: 700 }}>{box.section.name}</text>
                      <text x={box.w / 2} y={box.h / 2 + 14} textAnchor="middle" fill={c} style={{ fontSize: 12, fontWeight: 600 }}>
                        {box.section.rows.reduce((s, r) => s + r.seats.length, 0)} sedadiel (náhľad zjednodušený)
                      </text>
                    </>
                  ) : (
                    <>
                      <rect width={box.w} height={box.h} rx={12} fill={c} fillOpacity={0.06} stroke={c} strokeWidth={1.5} />
                      <text x={SEC_PAD} y={20} className="fill-gray-900 dark:fill-gray-100" style={{ fontSize: 14, fontWeight: 700 }}>{box.section.name}</text>
                      {[...box.section.rows].sort((a, b) => a.displayOrder - b.displayOrder).map((row, ri) => {
                        const ry = SEC_HEADER + ri * ROW_PITCH + ROW_PITCH / 2;
                        return (
                          <g key={row.id}>
                            <text x={SEC_PAD} y={ry + 4} className="fill-gray-500 dark:fill-gray-400" style={{ fontSize: 11, fontWeight: 600 }}>{row.label}</text>
                            {row.seats.map((seat, si) => {
                              const sx = ROW_LABEL_W + SEC_PAD + si * SEAT_PITCH + SEAT_R;
                              return (
                                <circle
                                  key={seat.id}
                                  cx={sx}
                                  cy={ry}
                                  r={SEAT_R}
                                  fill={seat.isAccessible ? '#fff' : c}
                                  fillOpacity={seat.isAccessible ? 1 : 0.55}
                                  stroke={c}
                                  strokeWidth={seat.isAccessible ? 2.5 : 1}
                                  onMouseEnter={() => setHover(`${box.section.name} · ${seat.label}${seat.isAccessible ? ' ♿' : ''}`)}
                                  onMouseLeave={() => setHover(null)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <title>{box.section.name} · {seat.label}{seat.isAccessible ? ' (bezbariérové)' : ''}</title>
                                </circle>
                              );
                            })}
                          </g>
                        );
                      })}
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* legenda */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/90 dark:bg-gray-900/90 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 shadow-sm">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-current bg-current opacity-55" /> sedadlo</span>
        <span className="flex items-center gap-1"><Accessibility size={13} /> bezbariérové</span>
        <span>zoom: koliesko · posun: ťahaj pozadie</span>
      </div>
    </div>
  );
}
