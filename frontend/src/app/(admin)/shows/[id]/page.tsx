'use client';

import { useEffect, useState, useRef, ChangeEvent, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { showsApi, showImagesApi, ShowDetail, ShowImage, Termin, TicketType, ticketTypesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-yellow-100 text-yellow-700',
  ON_SALE: 'bg-green-100 text-green-700',
  COMING_SOON: 'bg-blue-100 text-blue-700',
  SOLD_OUT: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function ShowDetailPage() {
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
        setError(e instanceof Error ? e.message : 'Chyba pri načítaní');
      } finally { setLoading(false); }
    });
  }, [id, router, load]);

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setUploadPreviews(picked.map((f) => ({ file: f, preview: URL.createObjectURL(f) })));
    e.target.value = '';
  }

  async function handleUpload() {
    if (!uploadPreviews.length) return;
    setUploading(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      await showImagesApi.upload(id, uploadPreviews.map((p) => p.file), token);
      uploadPreviews.forEach((p) => URL.revokeObjectURL(p.preview));
      setUploadPreviews([]);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri nahrávaní');
    } finally { setUploading(false); }
  }

  async function handleSetCover(imageId: string) {
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await showImagesApi.setCover(id, imageId, token);
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba'); }
  }

  async function handleDeleteImage(imageId: string) {
    if (!confirm('Odstrániť tento obrázok?')) return;
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await showImagesApi.delete(id, imageId, token);
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba pri mazaní'); }
  }

  async function handleDeleteTermin(terminId: string) {
    if (!confirm('Naozaj chcete odstrániť tento termín?')) return;
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      const { terminsApi } = await import('@/lib/api');
      await terminsApi.delete(id, terminId, token);
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba pri mazaní termínu'); }
  }

  async function handleDeleteTicketType(terminId: string, ticketTypeId: string) {
    if (!confirm('Naozaj chcete odstrániť tento typ lístka?')) return;
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await ticketTypesApi.delete(terminId, ticketTypeId, token);
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba pri mazaní'); }
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );
  if (!show) return <div className="p-8 text-red-600">{error || 'Podujatie nenájdené'}</div>;

  const cover = show.images?.find((i) => i.isCover);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg text-brand">Maxiticket</Link>
        <Link href="/shows" className="text-sm text-brand hover:underline">← Späť na podujatia</Link>
      </header>

      <main className="mx-auto max-w-4xl p-8 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Show header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4 items-start">
              {cover && (
                <img src={cover.squareUrl} alt={show.name} className="h-20 w-20 rounded-md object-cover flex-shrink-0 border border-gray-200" />
              )}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{show.name}</h1>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[show.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {show.status}
                  </span>
                </div>
                {show.category && <p className="text-sm text-gray-500">{show.category}</p>}
                {show.description && <p className="mt-1 text-sm text-gray-700">{show.description}</p>}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`/shows/${id}/edit`)}>Editovať</Button>
          </div>
        </div>

        {/* Gallery */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Galéria</h2>

          {/* Existing images */}
          {show.images && show.images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-4">
              {show.images.map((img: ShowImage) => (
                <div key={img.id} className="relative group rounded-md overflow-hidden border-2 border-transparent"
                  style={{ borderColor: img.isCover ? 'rgb(99 102 241)' : undefined }}>
                  <img src={img.squareUrl} alt="" className="w-full aspect-square object-cover" />

                  {img.isCover && (
                    <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      Titulka
                    </span>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                    {!img.isCover && (
                      <button
                        onClick={() => handleSetCover(img.id)}
                        className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2 py-1"
                      >
                        Nastaviť titulku
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="w-full text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1"
                    >
                      Odstrániť
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {show.images?.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">Žiadne obrázky. Nahrajte prvý obrázok.</p>
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
                + Pridať obrázky
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {uploadPreviews.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p.preview} alt="" className="h-16 w-16 rounded object-cover border border-gray-200" />
                      <button
                        onClick={() => setUploadPreviews((prev) => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, j) => j !== i); })}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center leading-none"
                      >×</button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-16 w-16 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xl hover:border-gray-400"
                  >+</button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" loading={uploading} onClick={handleUpload}>
                    Nahrať ({uploadPreviews.length})
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { uploadPreviews.forEach((p) => URL.revokeObjectURL(p.preview)); setUploadPreviews([]); }}>
                    Zrušiť
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Termins */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Termíny</h2>
            <Button size="sm" onClick={() => router.push(`/shows/${id}/termins/new`)}>+ Pridať termín</Button>
          </div>

          {(!show.termins || show.termins.length === 0) ? (
            <p className="text-sm text-gray-500">Žiadne termíny. Pridajte prvý termín.</p>
          ) : (
            <div className="space-y-4">
              {show.termins.map((termin: Termin) => (
                <TerminCard
                  key={termin.id}
                  termin={termin}
                  showId={id}
                  onDelete={() => handleDeleteTermin(termin.id)}
                  onDeleteTicketType={(ttId) => handleDeleteTicketType(termin.id, ttId)}
                  onAddTicketType={() => router.push(`/shows/${id}/termins/${termin.id}/ticket-types`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TerminCard({
  termin, showId, onDelete, onDeleteTicketType, onAddTicketType,
}: {
  termin: Termin;
  showId: string;
  onDelete: () => void;
  onDeleteTicketType: (id: string) => void;
  onAddTicketType: () => void;
}) {
  const date = new Date(termin.startsAt).toLocaleString('sk-SK');
  const ticketTypes: TicketType[] = termin.ticketTypes ?? [];

  return (
    <div className="rounded-md border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{date}</p>
          {termin.venue && (
            <p className="text-xs text-gray-500">{termin.venue.name}{termin.venue.city ? `, ${termin.venue.city}` : ''}</p>
          )}
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[termin.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {termin.status}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={onDelete}>Odstrániť</Button>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-600">Typy lístkov ({ticketTypes.length})</p>
          <button onClick={onAddTicketType} className="text-xs text-brand hover:underline">+ Pridať typ lístka</button>
        </div>
        {ticketTypes.length > 0 && (
          <div className="space-y-1">
            {ticketTypes.map((tt) => (
              <div key={tt.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                <span className="font-medium">{tt.name}</span>
                <span className="text-gray-500">{tt.price} {tt.currency}</span>
                <span className={tt.isActive ? 'text-green-600' : 'text-gray-400'}>{tt.isActive ? 'Aktívny' : 'Neaktívny'}</span>
                <button onClick={() => onDeleteTicketType(tt.id)} className="text-red-500 hover:text-red-700 ml-2">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
