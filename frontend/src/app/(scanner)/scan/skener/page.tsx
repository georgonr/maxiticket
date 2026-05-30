'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useScannerAuth, loadSelectedTermin, clearSelectedTermin, SelectedTermin } from '@/lib/scanner-auth';
import { scanApi, ScanValidateOk, ScanError } from '@/lib/api';
import { getValidToken } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: ScanValidateOk }
  | { kind: 'wrong_termin'; correctTermin: ScanError['correctTermin'] }
  | { kind: 'already_used'; usedAt: string | null; scannedBy: string | null }
  | { kind: 'error'; code: string }
  | { kind: 'manual' };

const SESSION_COUNT_KEY = 'scanSessionCount';

function formatDate(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString('sk-SK', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // AudioContext not available – silent fail
  }
}

// ─── QR Scanning ──────────────────────────────────────────────────────────────

async function decodeFrameNative(
  detector: any,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const codes: any[] = await detector.detect(canvas);
  return codes.length > 0 ? codes[0].rawValue : null;
}

async function decodeFrameJsQR(
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const jsQR = (await import('jsqr')).default;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const result = jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' });
  return result ? result.data : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkenerPage() {
  const router = useRouter();
  const { token, user, loading: authLoading, logout } = useScannerAuth();
  const [termin, setTermin] = useState<SelectedTermin | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ kind: 'scanning' });
  const [sessionCount, setSessionCount] = useState(0);
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);
  const pausedRef = useRef(false);

  // Load termin + session count
  useEffect(() => {
    const t = loadSelectedTermin();
    if (!t) { router.replace('/scan/terminy'); return; }
    setTermin(t);
    const saved = parseInt(localStorage.getItem(SESSION_COUNT_KEY) ?? '0', 10);
    setSessionCount(isNaN(saved) ? 0 : saved);
  }, [router]);

  // Initialise BarcodeDetector or fall back to jsQR
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detectorRef.current = null;
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Prístup ku kamere bol zamietnutý. Povolte kameru v nastaveniach prehliadača.');
      } else {
        setCameraError('Kamera nie je dostupná: ' + (err.message ?? err.name));
      }
    }
  }, []);

  const handleQrDetected = useCallback(async (qrToken: string) => {
    if (pausedRef.current || !termin) return;
    pausedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    setScanState({ kind: 'loading' });

    const tok = token ?? await getValidToken();
    if (!tok) { setScanState({ kind: 'error', code: 'AUTH' }); return; }

    try {
      const result = await scanApi.validate({ qrToken, terminId: termin.id }, tok);
      const newCount = sessionCount + 1;
      setSessionCount(newCount);
      localStorage.setItem(SESSION_COUNT_KEY, String(newCount));
      setScanState({ kind: 'ok', data: result });
      navigator.vibrate?.(200);
      beep();
      // Auto-continue after 2s
      setTimeout(() => { setScanState({ kind: 'scanning' }); pausedRef.current = false; startScanLoop(); }, 2000);
    } catch (err: any) {
      // AllExceptionsFilter wraps ConflictException body as: { message: { code, ... } }
      const errBody: any = err.body ?? {};
      const payload: ScanError =
        errBody.message && typeof errBody.message === 'object'
          ? (errBody.message as ScanError)
          : (errBody as ScanError);
      const code: string = payload.code ?? err.message ?? 'UNKNOWN';
      if (code === 'WRONG_TERMIN') {
        setScanState({ kind: 'wrong_termin', correctTermin: payload.correctTermin });
      } else if (code === 'ALREADY_USED') {
        setScanState({ kind: 'already_used', usedAt: payload.usedAt ?? null, scannedBy: payload.scannedBy ?? null });
      } else {
        setScanState({ kind: 'error', code });
      }
      navigator.vibrate?.([100, 50, 100]);
    }
  }, [termin, token, sessionCount, startCamera]);  // eslint-disable-line

  const startScanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const tick = async () => {
      if (pausedRef.current) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);

        let qrData: string | null = null;
        try {
          if (detectorRef.current) {
            qrData = await decodeFrameNative(detectorRef.current, canvas);
          } else {
            qrData = await decodeFrameJsQR(canvas);
          }
        } catch {
          // decode error – continue
        }

        if (qrData) {
          await handleQrDetected(qrData);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [handleQrDetected]);

  // Start camera + scan loop when termin is ready and state is scanning
  useEffect(() => {
    if (!termin || authLoading) return;
    if (scanState.kind === 'scanning') {
      startCamera().then(startScanLoop);
    }
    return stopCamera;
  }, [termin, authLoading]); // eslint-disable-line

  // Resume scan loop when state returns to scanning
  useEffect(() => {
    if (scanState.kind === 'scanning' && termin && !authLoading) {
      pausedRef.current = false;
      startScanLoop();
    }
  }, [scanState.kind]); // eslint-disable-line

  function handleDismiss() {
    setScanState({ kind: 'scanning' });
    pausedRef.current = false;
  }

  function handleChangeTermin() {
    stopCamera();
    clearSelectedTermin();
    router.push('/scan/terminy');
  }

  async function handleManualSubmit() {
    if (!manualInput.trim()) return;
    await handleQrDetected(manualInput.trim());
    setManualInput('');
  }

  if (authLoading || !termin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gray-950 text-white overflow-hidden">

      {/* Full-screen video feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        aria-hidden
      />
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" aria-hidden />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gray-950/50" aria-hidden />

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-gray-950/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white flex-shrink-0">
              MT
            </div>
            {user && <p className="text-xs text-gray-300 truncate max-w-[130px]">{user.email}</p>}
            <span className="ml-1 rounded-full bg-brand/20 px-2 py-0.5 text-xs font-semibold text-brand">
              {sessionCount}
            </span>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-300 active:bg-white/10"
          >
            Odhlásiť
          </button>
        </div>

        {/* Active termin badge */}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold">{termin.showName}</p>
            <p className="text-xs text-gray-300">{formatDate(termin.startsAt)}</p>
          </div>
          <button
            onClick={handleChangeTermin}
            className="ml-3 shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-gray-200 active:bg-white/20"
          >
            Zmeniť
          </button>
        </div>
      </header>

      {/* Scan frame */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <div className="relative h-64 w-64">
          {/* Corner brackets */}
          <span className="absolute top-0 left-0 h-8 w-8 border-l-4 border-t-4 border-brand rounded-tl-lg" />
          <span className="absolute top-0 right-0 h-8 w-8 border-r-4 border-t-4 border-brand rounded-tr-lg" />
          <span className="absolute bottom-0 left-0 h-8 w-8 border-l-4 border-b-4 border-brand rounded-bl-lg" />
          <span className="absolute bottom-0 right-0 h-8 w-8 border-r-4 border-b-4 border-brand rounded-br-lg" />

          {/* Scanning line animation */}
          {scanState.kind === 'scanning' && (
            <div className="absolute left-2 right-2 h-0.5 bg-brand/80 animate-scan-line" />
          )}

          {/* Loading spinner */}
          {scanState.kind === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-brand" />
            </div>
          )}

          {/* Camera error */}
          {cameraError && scanState.kind === 'scanning' && (
            <div className="absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-xl bg-gray-900/90 p-4 text-center">
              <span className="text-2xl">📷</span>
              <p className="text-xs text-red-300">{cameraError}</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-white/60">
          {scanState.kind === 'scanning' && !cameraError ? 'Namieriť na QR kód vstupenky' : ''}
        </p>
      </main>

      {/* Manual input */}
      <div className="relative z-10 px-4 pb-5">
        {scanState.kind === 'manual' ? (
          <div className="rounded-2xl bg-gray-900 p-4">
            <p className="mb-2 text-sm font-medium text-gray-200">Zadajte kód ručne</p>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none"
              placeholder="Vložte QR token..."
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleManualSubmit}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white active:bg-brand-dark"
              >
                Skenovať
              </button>
              <button
                onClick={() => setScanState({ kind: 'scanning' })}
                className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm text-gray-300 active:bg-gray-800"
              >
                Zrušiť
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setScanState({ kind: 'manual' }); pausedRef.current = true; }}
            className="w-full rounded-xl border border-white/20 py-2.5 text-sm text-gray-300 active:bg-white/10"
          >
            Manuálne zadať kód
          </button>
        )}
      </div>

      {/* Result overlays */}
      {scanState.kind === 'ok' && (
        <ResultOverlay color="green" onDismiss={handleDismiss} autoClose>
          <div className="text-5xl mb-3">✅</div>
          <p className="text-xl font-bold">Vpustiť</p>
          <p className="mt-2 text-lg font-semibold text-white/90">{scanState.data.ticketTypeName}</p>
          <p className="text-sm text-white/70">{scanState.data.showName}</p>
          {scanState.data.buyerName && (
            <p className="mt-1 text-sm text-white/60">{scanState.data.buyerName}</p>
          )}
          {(scanState.data.seatSection || scanState.data.seatRow || scanState.data.seatNumber) && (
            <p className="mt-1 text-xs text-white/50">
              {[scanState.data.seatSection, scanState.data.seatRow && `Rad ${scanState.data.seatRow}`, scanState.data.seatNumber && `Sedadlo ${scanState.data.seatNumber}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </ResultOverlay>
      )}

      {scanState.kind === 'wrong_termin' && (
        <ResultOverlay color="orange" onDismiss={handleDismiss}>
          <div className="text-5xl mb-3">⚠️</div>
          <p className="text-xl font-bold">Nesprávny termín</p>
          {scanState.correctTermin && (
            <p className="mt-2 text-sm text-white/80">
              Lístok patrí na:{' '}
              <span className="font-semibold">{scanState.correctTermin.showName ?? ''}</span>
              <br />
              {formatDate(scanState.correctTermin.startsAt)}
            </p>
          )}
          <button
            onClick={handleDismiss}
            className="mt-5 rounded-xl bg-white/20 px-8 py-3 text-sm font-semibold active:bg-white/30"
          >
            Pokračovať
          </button>
        </ResultOverlay>
      )}

      {scanState.kind === 'already_used' && (
        <ResultOverlay color="red" onDismiss={handleDismiss}>
          <div className="text-5xl mb-3">🚫</div>
          <p className="text-xl font-bold">Už použité</p>
          {scanState.usedAt && (
            <p className="mt-2 text-sm text-white/80">{formatTime(scanState.usedAt)}</p>
          )}
          {scanState.scannedBy && (
            <p className="text-sm text-white/60">Skenoval: {scanState.scannedBy}</p>
          )}
          <button
            onClick={handleDismiss}
            className="mt-5 rounded-xl bg-white/20 px-8 py-3 text-sm font-semibold active:bg-white/30"
          >
            Pokračovať
          </button>
        </ResultOverlay>
      )}

      {scanState.kind === 'error' && (
        <ResultOverlay color="red" onDismiss={handleDismiss}>
          <div className="text-5xl mb-3">❌</div>
          <p className="text-xl font-bold">
            {scanState.code === 'NOT_FOUND' || scanState.code === 'INVALID_SIGNATURE'
              ? 'Neplatný lístok'
              : scanState.code === 'CANCELLED'
              ? 'Lístok bol zrušený'
              : scanState.code === 'REFUNDED'
              ? 'Lístok bol refundovaný'
              : 'Chyba skenovania'}
          </p>
          <p className="mt-1 text-sm text-white/60">{scanState.code}</p>
          <button
            onClick={handleDismiss}
            className="mt-5 rounded-xl bg-white/20 px-8 py-3 text-sm font-semibold active:bg-white/30"
          >
            Pokračovať
          </button>
        </ResultOverlay>
      )}
    </div>
  );
}

// ─── Result overlay ───────────────────────────────────────────────────────────

function ResultOverlay({
  color,
  children,
  onDismiss,
  autoClose,
}: {
  color: 'green' | 'orange' | 'red';
  children: React.ReactNode;
  onDismiss: () => void;
  autoClose?: boolean;
}) {
  const bg = color === 'green' ? 'bg-green-600' : color === 'orange' ? 'bg-orange-500' : 'bg-red-600';
  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center text-white animate-fade-in ${bg}`}
      onClick={autoClose ? onDismiss : undefined}
    >
      {children}
    </div>
  );
}
