'use client';

import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { showsApi, ShowDetail, Termin, TicketType, ticketTypesApi } from '@/lib/api';
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load(token: string) {
    const data = await showsApi.get(id, token);
    setShow(data);
  }

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try {
        await load(token);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chyba pri načítaní');
      } finally {
        setLoading(false);
      }
    });
  }, [id, router]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleImageUpload() {
    if (!imageFile) return;
    setUploading(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      await showsApi.uploadImage(id, imageFile, token);
      await load(token);
      setImageFile(null);
      setImagePreview('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri nahrávaní obrázka');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteTermin(terminId: string) {
    if (!confirm('Naozaj chcete odstrániť tento termín?')) return;
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      const { terminsApi } = await import('@/lib/api');
      await terminsApi.delete(id, terminId, token);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri mazaní termínu');
    }
  }

  async function handleDeleteTicketType(terminId: string, ticketTypeId: string) {
    if (!confirm('Naozaj chcete odstrániť tento typ lístka?')) return;
    const token = await getValidToken();
    if (!token) { router.replace('/login'); return; }
    try {
      await ticketTypesApi.delete(terminId, ticketTypeId, token);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri mazaní typu lístka');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!show) {
    return <div className="p-8 text-red-600">{error || 'Podujatie nenájdené'}</div>;
  }

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
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{show.name}</h1>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[show.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {show.status}
                </span>
              </div>
              {show.category && <p className="text-sm text-gray-500">{show.category}</p>}
              {show.description && <p className="mt-2 text-sm text-gray-700">{show.description}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`/shows/${id}/edit`)}>Editovať</Button>
          </div>

          {/* Poster */}
          {show.posterUrl && (
            <img src={show.posterUrl} alt={show.name} className="mt-4 h-48 rounded-md object-cover" />
          )}

          {/* Image upload */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-2">Plagát / obrázok</p>
            <div className="flex items-center gap-3 flex-wrap">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
                Vybrať obrázok
              </Button>
              {imagePreview && (
                <>
                  <img src={imagePreview} alt="Náhľad" className="h-16 w-16 rounded object-cover border border-gray-200" />
                  <Button size="sm" loading={uploading} onClick={handleImageUpload}>Nahrať</Button>
                </>
              )}
            </div>
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

      {/* Ticket types */}
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
