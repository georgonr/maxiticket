'use client';

import { useEffect, useState, useRef, ChangeEvent, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { heroAdminApi, HeroBanner, AdminShow, ShowImage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  ChevronUp, ChevronDown, Pencil, Trash2, Plus, Check, X as XIcon,
  ImageIcon, LayoutDashboard, Images,
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseJwt(token: string): { role: string } | null {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

// ─── Banner form state ─────────────────────────────────────────────────────────

type BannerForm = {
  title: string; subtitle: string; imageUrl: string;
  ctaLabel: string; ctaUrl: string;
  sortOrder: string; isActive: boolean;
  activeFrom: string; activeUntil: string;
};

const EMPTY_FORM: BannerForm = {
  title: '', subtitle: '', imageUrl: '',
  ctaLabel: '', ctaUrl: '',
  sortOrder: '0', isActive: true,
  activeFrom: '', activeUntil: '',
};

function bannerToForm(b: HeroBanner): BannerForm {
  return {
    title: b.title,
    subtitle: b.subtitle ?? '',
    imageUrl: b.imageUrl,
    ctaLabel: b.ctaLabel ?? '',
    ctaUrl: b.ctaUrl ?? '',
    sortOrder: String(b.sortOrder),
    isActive: b.isActive,
    activeFrom: b.activeFrom ? b.activeFrom.slice(0, 16) : '',
    activeUntil: b.activeUntil ? b.activeUntil.slice(0, 16) : '',
  };
}

function formToPayload(f: BannerForm) {
  return {
    title: f.title.trim(),
    subtitle: f.subtitle.trim() || null,
    imageUrl: f.imageUrl.trim(),
    ctaLabel: f.ctaLabel.trim() || null,
    ctaUrl: f.ctaUrl.trim() || null,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    isActive: f.isActive,
    activeFrom: f.activeFrom || null,
    activeUntil: f.activeUntil || null,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ShowFilter = 'all' | 'promoted' | 'notPromoted';

export default function HeroAdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // Banners state
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [bannerError, setBannerError] = useState('');

  // Banner form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shows state
  const [shows, setShows] = useState<AdminShow[]>([]);
  const [showsLoading, setShowsLoading] = useState(true);
  const [showFilter, setShowFilter] = useState<ShowFilter>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Slider image modal state
  const [sliderImgModal, setSliderImgModal] = useState<{ show: AdminShow; images: ShowImage[] } | null>(null);
  const [sliderImgLoading, setSliderImgLoading] = useState(false);
  const [sliderImgSaving, setSliderImgSaving] = useState(false);

  // ── Auth gate ────────────────────────────────────────────────────────────────
  useEffect(() => {
    getValidToken().then((t) => {
      if (!t) { router.replace('/login'); return; }
      const claims = parseJwt(t);
      if (claims?.role !== 'SUPERADMIN') { router.replace('/dashboard'); return; }
      setToken(t);
    });
  }, [router]);

  // ── Load banners ─────────────────────────────────────────────────────────────
  const loadBanners = useCallback(async (t: string) => {
    setBannersLoading(true);
    try {
      const data = await heroAdminApi.listBanners(t);
      setBanners(data);
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : 'Chyba pri načítaní bannerov');
    } finally {
      setBannersLoading(false);
    }
  }, []);

  // ── Load shows ───────────────────────────────────────────────────────────────
  const loadShows = useCallback(async (t: string) => {
    setShowsLoading(true);
    try {
      const data = await heroAdminApi.listShows(t);
      setShows(data);
    } catch {
      // non-critical
    } finally {
      setShowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    loadBanners(token);
    loadShows(token);
  }, [token, loadBanners, loadShows]);

  // ── Banner form helpers ───────────────────────────────────────────────────────
  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(b: HeroBanner) {
    setEditingId(b.id);
    setForm(bannerToForm(b));
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError('');
  }

  function fieldChange(field: keyof BannerForm, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    e.target.value = '';
    setUploading(true);
    try {
      const { imageUrl } = await heroAdminApi.uploadImage(file, token);
      setForm((f) => ({ ...f, imageUrl }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload zlyhal');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!form.title.trim()) { setFormError('Slogan je povinný'); return; }
    if (!form.imageUrl.trim()) { setFormError('Obrázok je povinný'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = formToPayload(form);
      if (editingId) {
        const updated = await heroAdminApi.updateBanner(editingId, payload, token);
        setBanners((prev) => prev.map((b) => b.id === editingId ? updated : b));
      } else {
        const created = await heroAdminApi.createBanner(payload, token);
        setBanners((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Uloženie zlyhalo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token || !confirm('Naozaj zmazať tento banner?')) return;
    // Optimistic
    setBanners((prev) => prev.filter((b) => b.id !== id));
    try {
      await heroAdminApi.deleteBanner(id, token);
    } catch {
      // Re-fetch on error
      loadBanners(token);
    }
  }

  async function moveOrder(id: string, direction: 'up' | 'down') {
    if (!token) return;
    const idx = banners.findIndex((b) => b.id === id);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === banners.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = [...banners];
    const newSortA = newOrder[swapIdx].sortOrder;
    const newSortB = newOrder[idx].sortOrder;

    // Optimistic swap
    newOrder[idx] = { ...newOrder[idx], sortOrder: newSortA };
    newOrder[swapIdx] = { ...newOrder[swapIdx], sortOrder: newSortB };
    newOrder.sort((a, b) => a.sortOrder - b.sortOrder);
    setBanners(newOrder);

    try {
      await Promise.all([
        heroAdminApi.updateBanner(banners[idx].id, { sortOrder: newSortA }, token),
        heroAdminApi.updateBanner(banners[swapIdx].id, { sortOrder: newSortB }, token),
      ]);
    } catch {
      loadBanners(token);
    }
  }

  async function toggleActive(banner: HeroBanner) {
    if (!token) return;
    const updated = { ...banner, isActive: !banner.isActive };
    setBanners((prev) => prev.map((b) => b.id === banner.id ? updated : b));
    try {
      await heroAdminApi.updateBanner(banner.id, { isActive: updated.isActive }, token);
    } catch {
      loadBanners(token);
    }
  }

  // ── Promote toggle ───────────────────────────────────────────────────────────
  async function togglePromote(show: AdminShow) {
    if (!token || togglingId) return;
    setTogglingId(show.id);
    const newVal = !show.isPromoted;
    // Optimistic
    setShows((prev) => prev.map((s) => s.id === show.id ? { ...s, isPromoted: newVal } : s));
    try {
      await heroAdminApi.promoteShow(show.id, newVal, token);
    } catch {
      loadShows(token);
    } finally {
      setTogglingId(null);
    }
  }

  // ── Slider image modal ───────────────────────────────────────────────────────
  async function openSliderImgModal(show: AdminShow) {
    if (!token) return;
    setSliderImgLoading(true);
    setSliderImgModal({ show, images: [] });
    try {
      const imgs = await heroAdminApi.listShowImages(show.id, token);
      setSliderImgModal({ show, images: imgs });
    } catch {
      setSliderImgModal(null);
    } finally {
      setSliderImgLoading(false);
    }
  }

  async function selectSliderImage(showId: string, imageId: string | null) {
    if (!token || sliderImgSaving) return;
    setSliderImgSaving(true);
    setShows((prev) => prev.map((s) => s.id === showId ? { ...s, sliderImageId: imageId } : s));
    try {
      await heroAdminApi.setSliderImage(showId, imageId, token);
    } catch {
      loadShows(token);
    } finally {
      setSliderImgSaving(false);
      setSliderImgModal(null);
    }
  }

  // ── Filter shows ─────────────────────────────────────────────────────────────
  const filteredShows = shows.filter((s) => {
    if (showFilter === 'promoted') return s.isPromoted;
    if (showFilter === 'notPromoted') return !s.isPromoted;
    return true;
  });

  // ── Render guard ─────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg text-brand">TicketAll</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/shows" className="text-gray-600 hover:text-brand transition-colors">Podujatia</Link>
          <Link href="/hero" className="font-medium text-brand underline underline-offset-2">Hero slider</Link>
          <Link href="/dashboard" className="text-gray-500 hover:text-brand transition-colors flex items-center gap-1">
            <LayoutDashboard size={14} />
            Dashboard
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl p-8 space-y-10">

        {/* ── Section 1: Banners ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketingové bannery</h1>
              <p className="text-sm text-gray-500 mt-0.5">Zoraďované podľa sortOrder, zobrazované v slideri.</p>
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus size={15} className="mr-1.5" /> Pridať banner
            </Button>
          </div>

          {bannerError && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{bannerError}</div>
          )}

          {bannersLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
            </div>
          ) : banners.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="text-gray-400 text-sm mb-3">Zatiaľ žiadne bannery.</p>
              <Button variant="outline" size="sm" onClick={openCreate}><Plus size={13} className="mr-1" /> Pridať prvý banner</Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-16 px-3 py-3 text-left font-medium text-gray-500">Poradie</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Banner</th>
                    <th className="w-24 px-4 py-3 text-center font-medium text-gray-500">Aktívny</th>
                    <th className="w-40 px-4 py-3 text-left font-medium text-gray-500">Platnosť</th>
                    <th className="w-24 px-4 py-3 text-right font-medium text-gray-500">Akcie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {banners.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5 items-center">
                          <button
                            onClick={() => moveOrder(b.id, 'up')}
                            disabled={idx === 0}
                            className="rounded p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20"
                            title="Posunúť nahor"
                          ><ChevronUp size={14} /></button>
                          <span className="text-xs font-mono text-gray-500 w-5 text-center">{b.sortOrder}</span>
                          <button
                            onClick={() => moveOrder(b.id, 'down')}
                            disabled={idx === banners.length - 1}
                            className="rounded p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20"
                            title="Posunúť nadol"
                          ><ChevronDown size={14} /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {b.imageUrl ? (
                            <img src={b.imageUrl} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0 bg-gray-100" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                              <ImageIcon size={16} className="text-gray-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-xs">{b.title}</p>
                            {b.subtitle && <p className="text-xs text-gray-400 truncate max-w-xs">{b.subtitle}</p>}
                            {b.ctaUrl && <p className="text-xs text-blue-500 truncate max-w-xs">{b.ctaUrl}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleActive(b)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${b.isActive ? 'bg-brand' : 'bg-gray-200'}`}
                          role="switch"
                          aria-checked={b.isActive}
                          title={b.isActive ? 'Aktívny – klikni na deaktiváciu' : 'Neaktívny – klikni na aktiváciu'}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${b.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {b.activeFrom || b.activeUntil ? (
                          <div>
                            {b.activeFrom && <div>Od: {fmtDate(b.activeFrom)}</div>}
                            {b.activeUntil && <div>Do: {fmtDate(b.activeUntil)}</div>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(b)}
                            className="rounded p-1.5 text-gray-400 hover:text-brand hover:bg-brand/5 transition-colors"
                            title="Upraviť"
                          ><Pencil size={13} /></button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Zmazať"
                          ><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Section 2: Promoted Shows ────────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Promoted podujatia</h2>
            <p className="text-sm text-gray-500 mt-0.5">Podujatia so zapnutým promoted flagom sa zobrazia v slideri (musia byť PUBLISHED + mať aktívny termín).</p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            {([['all', 'Všetky'], ['promoted', 'Promoted'], ['notPromoted', 'Nepromoted']] as [ShowFilter, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setShowFilter(val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showFilter === val ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >{label}</button>
            ))}
          </div>

          {showsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
            </div>
          ) : filteredShows.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm text-gray-400">Žiadne podujatia v tomto filteri.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Podujatie</th>
                    <th className="w-24 px-4 py-3 text-center font-medium text-gray-500">Stav</th>
                    <th className="w-36 px-4 py-3 text-center font-medium text-gray-500">Slider obrázok</th>
                    <th className="w-28 px-4 py-3 text-center font-medium text-gray-500">Promoted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredShows.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {s.images[0] ? (
                            <img src={s.images[0].squareUrl} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0 bg-gray-100" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <ImageIcon size={14} className="text-gray-300" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === 'PUBLISHED' ? 'bg-green-100 text-green-700'
                          : s.status === 'DRAFT' ? 'bg-gray-100 text-gray-600'
                          : 'bg-yellow-100 text-yellow-700'
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openSliderImgModal(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-brand/30 hover:text-brand hover:bg-brand/5 transition-colors"
                          title="Vybrať slider obrázok"
                        >
                          <Images size={12} />
                          {s.sliderImageId ? 'Vlastný' : 'Titulka'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePromote(s)}
                          disabled={togglingId === s.id}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${s.isPromoted ? 'bg-brand' : 'bg-gray-200'}`}
                          role="switch"
                          aria-checked={s.isPromoted}
                          title={s.isPromoted ? 'Promoted – klikni na vypnutie' : 'Nepromoted – klikni na zapnutie'}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${s.isPromoted ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ── Slider Image Modal ──────────────────────────────────────────────── */}
      {sliderImgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Slider obrázok</h3>
                <p className="text-xs text-gray-400 mt-0.5">{sliderImgModal.show.name}</p>
              </div>
              <button onClick={() => setSliderImgModal(null)} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                <XIcon size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              {sliderImgLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />)}
                </div>
              ) : (
                <>
                  {/* Use cover option */}
                  <button
                    onClick={() => selectSliderImage(sliderImgModal.show.id, null)}
                    disabled={sliderImgSaving}
                    className={`w-full mb-4 flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      sliderImgModal.show.sliderImageId === null
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-gray-200 text-gray-600 hover:border-brand/30 hover:text-brand'
                    }`}
                  >
                    <ImageIcon size={16} />
                    <span>Použiť titulku (cover) – predvolené</span>
                    {sliderImgModal.show.sliderImageId === null && <Check size={14} className="ml-auto" />}
                  </button>

                  {sliderImgModal.images.length === 0 ? (
                    <p className="text-sm text-center text-gray-400 py-6">Toto podujatie nemá žiadne obrázky v galérii.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {sliderImgModal.images.map((img) => {
                        const selected = sliderImgModal.show.sliderImageId === img.id;
                        return (
                          <button
                            key={img.id}
                            onClick={() => selectSliderImage(sliderImgModal.show.id, img.id)}
                            disabled={sliderImgSaving}
                            className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all disabled:opacity-50 ${
                              selected ? 'border-brand ring-2 ring-brand/30' : 'border-transparent hover:border-brand/40'
                            }`}
                            title="Nastaviť ako slider obrázok"
                          >
                            <img src={img.squareUrl} alt="" className="h-full w-full object-cover" />
                            {selected && (
                              <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                                <div className="rounded-full bg-brand p-1"><Check size={12} className="text-white" /></div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSliderImgModal(null)}>Zavrieť</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner Form Modal ────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {editingId ? 'Upraviť banner' : 'Pridať banner'}
              </h3>
              <button onClick={closeForm} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <XIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto px-6 py-5 space-y-4 flex-1">

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Obrázok *</label>
                <div className="flex items-start gap-3">
                  <div
                    className="h-20 w-20 flex-shrink-0 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-brand/50 transition-colors overflow-hidden"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : uploading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    ) : (
                      <ImageIcon size={22} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                      {uploading ? 'Nahrávam…' : 'Vybrať obrázok'}
                    </Button>
                    <p className="text-xs text-gray-400">JPEG / PNG / WebP, max 10 MB. Bude orezaný na štvorec 1000×1000.</p>
                    {form.imageUrl && (
                      <p className="text-xs text-green-600 flex items-center gap-1"><Check size={11} /> Obrázok nahratý</p>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImagePick} />
                </div>
                {/* Or paste URL directly */}
                <Input
                  id="imageUrl" label="" placeholder="…alebo vložte URL obrázka"
                  value={form.imageUrl}
                  onChange={(e) => fieldChange('imageUrl', e.target.value)}
                  className="mt-2"
                />
              </div>

              <Input id="title" label="Slogan (nadpis) *" placeholder="Letný festival 2026"
                value={form.title} onChange={(e) => fieldChange('title', e.target.value)} required />

              <Input id="subtitle" label="Sub-slogan (voliteľne)" placeholder="Najväčší festival roka"
                value={form.subtitle} onChange={(e) => fieldChange('subtitle', e.target.value)} />

              <div className="grid grid-cols-2 gap-3">
                <Input id="ctaLabel" label="CTA text" placeholder="Kúpiť lístky"
                  value={form.ctaLabel} onChange={(e) => fieldChange('ctaLabel', e.target.value)} />
                <Input id="ctaUrl" label="CTA URL" placeholder="/events/festival"
                  value={form.ctaUrl} onChange={(e) => fieldChange('ctaUrl', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input id="sortOrder" label="SortOrder" type="number" min="0"
                  value={form.sortOrder} onChange={(e) => fieldChange('sortOrder', e.target.value)} />
                <div className="flex flex-col justify-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.isActive}
                      onClick={() => fieldChange('isActive', !form.isActive)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${form.isActive ? 'bg-brand' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${form.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-sm font-medium text-gray-700">Aktívny</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DateTimePicker id="activeFrom" label="Aktívny od" value={form.activeFrom}
                    onChange={(v) => fieldChange('activeFrom', v)} />
                  <p className="mt-1 text-xs text-gray-400">Prázdne = okamžite aktívny</p>
                </div>
                <div>
                  <DateTimePicker id="activeUntil" label="Aktívny do" value={form.activeUntil}
                    onChange={(v) => fieldChange('activeUntil', v)} />
                  <p className="mt-1 text-xs text-gray-400">Prázdne = bez expirácie</p>
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}
            </form>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <Button type="button" variant="outline" size="sm" onClick={closeForm}>Zrušiť</Button>
              <Button type="submit" size="sm" loading={saving} onClick={handleSave}>
                {editingId ? 'Uložiť zmeny' : 'Vytvoriť banner'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
