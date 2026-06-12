'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QrCanvas({ value, size = 200 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    }).catch(() => {});
  }, [value, size]);

  return <canvas ref={canvasRef} className="rounded-lg border border-gray-200" />;
}
