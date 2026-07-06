'use client';

import { useEffect, useState, useRef, ChangeEvent, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import { getValidToken } from '@/lib/auth';
import { showsApi, showImagesApi, ShowDetail, ShowImage, Termin, TicketType, CreateTicketTypeBody, ticketTypesApi, refundExportApi, eventOpsApi, CancelEventResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { QrCode } from 'lucide-react';
import { CouponsSection } from '@/components/coupons/CouponsSection';
import { CancelTerminModal } from '@/components/shows/CancelTerminModal';
import { CancelShowModal } from '@/components/shows/CancelShowModal';
import { useAuth } from '@/hooks/useAuth';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-yellow-100 text-yellow-700',
  ON_SALE: 'bg-green-100 text-green-700',
  COMING_SOON: 'bg-blue-100 text-blue-700',
  SOLD_OUT: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function ShowDetailPage() {
  const t = useTranslations('organizer.editor');
  const format = useFormatter();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPreviews, setUploadPreviews] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (token: string) => {
    const data = await showsApi.get(id, token);
    setShow(data);
  }, [id]);

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try { await load(token); } catch (e) {
        setError(e instanceof Error ? e.message : t('errLoad'));
      } finally { setLoading(false); }
    });
  }, [id, router, load]);

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    const newEntries = picked.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setUploadPreviews((prev) => [...prev, ...newEntries]);
    e.target.value = '';
  }

  async function handleUpload() {
    if (!uploadPreviews.length) return;
    setError('');
    setUploading(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      await showImagesApi.upload(id, uploadPreviews.map((p) => p.file), token);
      uploadPreviews.forEach((p) => URL.revokeObjectURL(p.preview));
      setUploadPreviews([]);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errUpload'));
    } finally { setUploading(false); }
  }

  async function handleSetCover(imageId: string) {
    setError('');
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await showImagesApi.setCover(id, imageId, token);
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : t('errGeneric')); }
  }

  async function handleDeleteImage(imageId: string) {
    if (!confirm(t('confirmDeleteImage'))) return;
    setError('');
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await showImagesApi.delete(id, imageId, token);
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : t('errDelete')); }
  }

  async function handleDeleteTermin(terminId: string) {
    if (!confirm(t('confirmDeleteTermin'))) return;
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      const { terminsApi } = await import('@/lib/api');
      await terminsApi.delete(id, terminId, token);
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : t('errDeleteTermin')); }
  }

  async function handleDeleteTicketType(terminId: string, ticketTypeId: string) {
    if (!confirm(t('confirmDeleteTicketType'))) return;
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await ticketTypesApi.delete(terminId, ticketTypeId, token);
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : t('errDelete')); }
  }

  const { isSuperAdmin } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [cancelTermin, setCancelTermin] = useState<Termin | null>(null);
  const [notice, setNotice] = useState('');
  // Event-level zrušenie / kópia
  const [showCancelMode, setShowCancelMode] = useState<'request' | 'execute' | null>(null);
  const [copying, setCopying] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelEventResult | null>(null);

  const te = useTranslations('organizer.eventCancel');

  // Organizer žiada o zrušenie → SUPERADMIN notifikovaný.
  async function handleRequestCancel() {
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    await eventOpsApi.requestCancel(id, token);
    setShowCancelMode(null);
    setNotice(te('requestedNotice'));
    await load(token);
  }

  // SUPERADMIN reálne zruší podujatie (hromadný refund).
  async function handleCancelEvent(reason?: string) {
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    const res = await eventOpsApi.cancelEvent(id, reason, token);
    setShowCancelMode(null);
    setCancelResult(res);
    await load(token);
  }

  // Kópia podujatia → presmeruj na editáciu nového draftu.
  async function handleCopyEvent() {
    setError('');
    setCopying(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const copy = await eventOpsApi.copyEvent(id, token);
      router.push(`/organizer/shows/${copy.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : te('copyFailed'));
      setCopying(false);
    }
  }

  // Krok 27: zrušenie termínu (po potvrdení v modáli).
  async function handleCancelTermin(occurrenceId: string) {
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    const res = await eventOpsApi.cancelOccurrence(id, occurrenceId, token);
    setCancelTermin(null);
    setNotice(t('terminCancelledNotice', { orderCount: res.orderCount, emailsSent: res.emailsSent }));
    await load(token);
  }

  // Úloha 26: stiahne CSV platieb na manuálny refund (príprava na zrušenie podujatia).
  async function handleRefundExport(occurrenceId?: string) {
    setError('');
    setExporting(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const blob = await refundExportApi.download(id, token, occurrenceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `refund-export-${id}${occurrenceId ? '-' + occurrenceId : ''}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errRefundExport'));
    } finally {
      setExporting(false);
    }
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );
  if (!show) return <div className="p-8 text-red-600">{error || t('notFound')}</div>;

  const cover = show.images?.find((i) => i.isCover);

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900">
      <main className="mx-auto max-w-4xl p-8 space-y-6">
        <Link href="/organizer/shows" className="inline-block text-sm text-brand hover:underline">← {t('backToShows')}</Link>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {notice && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{notice}</div>
        )}

        {/* Podujatie zrušené – banner */}
        {show.status === 'CANCELLED' && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <strong>{te('bannerCancelled')}</strong>
            {show.cancellationReason && <span className="block mt-1 text-red-600">{te('reasonLabel')}: {show.cancellationReason}</span>}
          </div>
        )}

        {/* Žiadosť o zrušenie (organizer podal, SUPERADMIN vidí a vykoná) */}
        {show.status !== 'CANCELLED' && show.cancelRequestedAt && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {te('bannerRequested')}
          </div>
        )}

        {/* Výsledok zrušenia (po vykonaní SUPERADMINom) */}
        {cancelResult && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            {te('resultSummary', {
              cancelled: cancelResult.cancelledCount,
              refunded: cancelResult.refundedCount,
              total: cancelResult.totalRefunded.toFixed(2),
            })}
          </div>
        )}

        {/* Show header */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4 items-start min-w-0">
              {cover && (
                <img src={cover.squareUrl} alt={show.name} className="h-20 w-20 rounded-md object-cover flex-shrink-0 border border-gray-200 dark:border-gray-800" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{show.name}</h1>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[show.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    {t.has(`terminStatus.${show.status}`) ? t(`terminStatus.${show.status}`) : show.status}
                  </span>
                </div>
                {show.category && <p className="text-sm text-gray-500 dark:text-gray-400">{show.category}</p>}
                {show.description && <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{show.description}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" loading={exporting} onClick={() => handleRefundExport()} title={t('refundExportTitle')}>
                {t('refundExportBtn')}
              </Button>
              <Button variant="outline" size="sm" loading={copying} onClick={handleCopyEvent}>{te('copyBtn')}</Button>
              <Button variant="outline" size="sm" onClick={() => router.push(`/organizer/shows/${id}/edit`)}>{t('edit')}</Button>
              {show.status !== 'CANCELLED' && (
                <button
                  onClick={() => setShowCancelMode(isSuperAdmin ? 'execute' : 'request')}
                  className="inline-flex items-center justify-center rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  {isSuperAdmin ? te('cancelBtn') : te('requestBtn')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-1">{t('galleryTitle')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {t('galleryHint')}
          </p>

          {/* Existing images */}
          {show.images && show.images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-4">
              {show.images.map((img: ShowImage) => (
                <div key={img.id} className="relative group rounded-md overflow-hidden border-2 border-transparent"
                  style={{ borderColor: img.isCover ? 'rgb(99 102 241)' : undefined }}>
                  <img src={img.squareUrl} alt="" className="w-full aspect-square object-cover" />

                  {img.isCover && (
                    <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {t('coverBadge')}
                    </span>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                    {!img.isCover && (
                      <button
                        onClick={() => handleSetCover(img.id)}
                        className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2 py-1"
                      >
                        {t('setCover')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="w-full text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {show.images?.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">{t('noImages')}</p>
          )}

          {/* Upload new images */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />

            {uploadPreviews.length === 0 ? (
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                + {t('addImages')}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {uploadPreviews.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p.preview} alt="" className="h-16 w-16 rounded object-cover border border-gray-200 dark:border-gray-800" />
                      <button
                        onClick={() => setUploadPreviews((prev) => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, j) => j !== i); })}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center leading-none"
                      >×</button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-16 w-16 rounded border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xl hover:border-gray-400"
                  >+</button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" loading={uploading} onClick={handleUpload}>
                    {t('uploadCount', { count: uploadPreviews.length })}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { uploadPreviews.forEach((p) => URL.revokeObjectURL(p.preview)); setUploadPreviews([]); }}>
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Termins */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('terminsTitle')}</h2>
            <Button size="sm" onClick={() => router.push(`/organizer/shows/${id}/termins/new`)}>+ {t('addTermin')}</Button>
          </div>

          {(!show.termins || show.termins.length === 0) ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('noTermins')}</p>
          ) : (
            <div className="space-y-4">
              {show.termins.map((termin: Termin) => (
                <TerminCard
                  key={termin.id}
                  termin={termin}
                  showId={id}
                  onDelete={() => handleDeleteTermin(termin.id)}
                  onDeleteTicketType={(ttId) => handleDeleteTicketType(termin.id, ttId)}
                  onAddTicketType={() => router.push(`/organizer/shows/${id}/termins/${termin.id}/ticket-types`)}
                  onRequestCancel={() => setCancelTermin(termin)}
                  onExportRefund={() => handleRefundExport(termin.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Coupons (14B-2) */}
        <CouponsSection
          showId={id}
          showTitle={show.name}
          organizerId={show.organizerId}
          ticketTypes={(show.termins ?? []).flatMap((t: Termin) =>
            (t.ticketTypes ?? []).map((tt: TicketType) => ({ id: tt.id, label: tt.name })),
          )}
        />
      </main>

      {cancelTermin && (
        <CancelTerminModal
          showName={show.name}
          terminLabel={format.dateTime(new Date(cancelTermin.startsAt), { dateStyle: 'medium', timeStyle: 'short' })}
          onClose={() => setCancelTermin(null)}
          onConfirm={() => handleCancelTermin(cancelTermin.id)}
        />
      )}
      {showCancelMode && (
        <CancelShowModal
          mode={showCancelMode}
          showName={show.name}
          onClose={() => setShowCancelMode(null)}
          onConfirm={showCancelMode === 'execute' ? handleCancelEvent : () => handleRequestCancel()}
        />
      )}
    </div>
  );
}

function TerminCard({
  termin, showId, onDelete, onDeleteTicketType, onAddTicketType, onRequestCancel, onExportRefund,
}: {
  termin: Termin;
  showId: string;
  onDelete: () => void;
  onDeleteTicketType: (id: string) => void;
  onAddTicketType: () => void;
  onRequestCancel: () => void;
  onExportRefund: () => void;
}) {
  const t = useTranslations('organizer.editor');
  const format = useFormatter();
  const date = format.dateTime(new Date(termin.startsAt), { dateStyle: 'medium', timeStyle: 'short' });
  const isCancelled = termin.status === 'CANCELLED';
  const isGeneral = (termin.mode ?? 'GENERAL') === 'GENERAL';

  // Lokálny stav typov lístkov (inline edit + QR slider); re-sync pri reloade rodiča.
  const [tts, setTts] = useState<TicketType[]>(termin.ticketTypes ?? []);
  useEffect(() => { setTts(termin.ticketTypes ?? []); }, [termin.ticketTypes]);
  const [qrSaving, setQrSaving] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', price: '', totalQuantity: '', maxPerOrder: '', isActive: true });

  async function toggleQr(tt: TicketType) {
    setQrSaving(tt.id);
    try {
      const token = await getValidToken();
      if (!token) return;
      const u = await ticketTypesApi.update(termin.id, tt.id, { qrPaymentEnabled: !tt.qrPaymentEnabled }, token);
      setTts((prev) => prev.map((x) => (x.id === tt.id ? { ...x, qrPaymentEnabled: u.qrPaymentEnabled } : x)));
    } catch { /* stav sa neprepne */ } finally { setQrSaving(null); }
  }

  function startEdit(tt: TicketType) {
    setEditId(tt.id);
    setEditForm({
      name: tt.name,
      price: String(tt.price),
      totalQuantity: tt.totalQuantity != null ? String(tt.totalQuantity) : '',
      maxPerOrder: String(tt.maxPerOrder),
      isActive: tt.isActive,
    });
  }
  function cancelEdit() { setEditId(null); }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const body: Partial<CreateTicketTypeBody> = {
        name: editForm.name.trim(),
        price: Number(editForm.price),
        maxPerOrder: Number(editForm.maxPerOrder) || 10,
        isActive: editForm.isActive,
      };
      const q = editForm.totalQuantity.trim();
      if (q !== '') body.totalQuantity = Number(q);
      const u = await ticketTypesApi.update(termin.id, editId, body, token);
      setTts((prev) => prev.map((x) => (x.id === editId ? u : x)));
      setEditId(null);
    } catch { /* ponechaj editor */ } finally { setEditSaving(false); }
  }

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{date}</p>
          {termin.venue && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{termin.venue.name}{termin.venue.city ? `, ${termin.venue.city}` : ''}</p>
          )}
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[termin.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            {isCancelled ? t('terminStatus.CANCELLED') : (t.has(`terminStatus.${termin.status}`) ? t(`terminStatus.${termin.status}`) : termin.status)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button onClick={onExportRefund} className="text-xs text-brand hover:underline">{t('exportRefundCsv')}</button>
          {!isCancelled && (
            <button onClick={onRequestCancel} className="text-xs font-medium text-red-600 hover:underline">{t('cancelTermin')}</button>
          )}
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={onDelete}>{t('delete')}</Button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('ticketTypes', { count: tts.length })}</p>
          <button onClick={onAddTicketType} className="text-xs text-brand hover:underline">+ {t('addTicketType')}</button>
        </div>
        {tts.length > 0 && (
          <div className="space-y-1">
            {tts.map((tt) => (
              <div key={tt.id} className="rounded bg-gray-50 dark:bg-gray-900 px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium">{tt.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">{format.number(Number(tt.price), { style: 'currency', currency: tt.currency })}</span>
                  <span className={tt.isActive ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}>{tt.isActive ? t('active') : t('inactive')}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {isGeneral && (
                      <span className="flex items-center gap-1" title={t('qrLabel')}>
                        <QrCode size={13} className={tt.qrPaymentEnabled ? 'text-brand' : 'text-gray-400'} />
                        <ToggleSwitch checked={tt.qrPaymentEnabled} disabled={qrSaving === tt.id} onChange={() => toggleQr(tt)} label={t('qrLabel')} size="sm" />
                      </span>
                    )}
                    <button onClick={() => (editId === tt.id ? cancelEdit() : startEdit(tt))} className="text-brand hover:underline">
                      {editId === tt.id ? t('cancel') : t('editAction')}
                    </button>
                    <button onClick={() => onDeleteTicketType(tt.id)} className="text-red-500 hover:text-red-700">×</button>
                  </div>
                </div>

                {editId === tt.id && (
                  <div className="mt-2 grid grid-cols-1 gap-2 border-t border-gray-200 dark:border-gray-700 pt-2 sm:grid-cols-2">
                    <label className="block"><span className="mb-0.5 block text-[11px] text-gray-500">{t('nameLabel')}</span>
                      <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></label>
                    <label className="block"><span className="mb-0.5 block text-[11px] text-gray-500">{t('priceLabel')}</span>
                      <Input type="number" step="0.01" min={0} value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} /></label>
                    <label className="block"><span className="mb-0.5 block text-[11px] text-gray-500">{t('quantityLabel')}</span>
                      <Input type="number" min={1} value={editForm.totalQuantity} onChange={(e) => setEditForm((f) => ({ ...f, totalQuantity: e.target.value }))} placeholder={t('unlimitedPlaceholder')} /></label>
                    <label className="block"><span className="mb-0.5 block text-[11px] text-gray-500">{t('maxPerOrderLabel')}</span>
                      <Input type="number" min={1} value={editForm.maxPerOrder} onChange={(e) => setEditForm((f) => ({ ...f, maxPerOrder: e.target.value }))} /></label>
                    <label className="flex items-center gap-2 sm:col-span-2">
                      <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-gray-300 dark:border-gray-700 text-brand focus:ring-brand" />
                      <span className="text-xs">{t('activeForSale')}</span>
                    </label>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                      <Button variant="outline" size="sm" onClick={cancelEdit}>{t('cancel')}</Button>
                      <Button size="sm" loading={editSaving} onClick={saveEdit}>{t('save')}</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
