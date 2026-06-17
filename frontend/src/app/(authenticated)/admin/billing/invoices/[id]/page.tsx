'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import { ArrowLeft, Trash2, Plus, FileDown, Lock, Send, CheckCircle2, Banknote } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { billingApi, Invoice } from '@/lib/api/billing';
import { SectionCard, Skeleton, ErrorState } from '@/components/dashboard/parts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('billing.invoice');
  const tb = useTranslations('billing');
  const format = useFormatter();
  const eur = (cents: number) => format.number(cents / 100, { style: 'currency', currency: 'EUR' });
  const dISO = (iso: string) => iso.slice(0, 10);

  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // header edit
  const [taxDate, setTaxDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  // add custom item
  const [aDesc, setADesc] = useState('');
  const [aQty, setAQty] = useState('1');
  const [aPrice, setAPrice] = useState('');
  const [aVat, setAVat] = useState('23');

  const apply = (i: Invoice) => {
    setInv(i);
    setTaxDate(dISO(i.taxDate));
    setDueDate(dISO(i.dueDate));
    setNote(i.note ?? '');
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      apply(await billingApi.getInvoice(id, token));
    } catch {
      setError(tb('errLoad'));
    } finally {
      setLoading(false);
    }
  }, [id, tb]);

  useEffect(() => { load(); }, [load]);

  async function run(fn: (token: string) => Promise<Invoice>, okMsg?: string) {
    setBusy(true); setToast(null);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      apply(await fn(token));
      if (okMsg) setToast({ msg: okMsg, ok: true });
    } catch {
      setToast({ msg: t('toastErr'), ok: false });
    } finally {
      setBusy(false);
    }
  }

  const saveHeader = () => run((token) => billingApi.updateInvoice(id, { taxDate, dueDate, note }, token), t('toastSaved'));
  const addItem = () => {
    const price = Math.round(Number(aPrice) * 100);
    if (!aDesc.trim() || !Number.isFinite(price)) return;
    run((token) => billingApi.addLineItem(id, { description: aDesc.trim(), quantity: Number(aQty) || 1, unitPriceCents: price, vatPercent: Number(aVat) || 0 }, token), t('toastSaved'))
      .then(() => { setADesc(''); setAQty('1'); setAPrice(''); });
  };
  const delItem = (lineId: string) => run((token) => billingApi.deleteLineItem(id, lineId, token));
  const finalize = () => { if (window.confirm(t('finalizeConfirm'))) run((token) => billingApi.finalize(id, token), t('toastFinalized')); };
  const sendInv = () => { if (window.confirm(t('sendConfirm'))) run((token) => billingApi.sendInvoice(id, token), t('toastSent')); };
  const markPaid = () => run((token) => billingApi.markPaid(id, token), t('toastSaved'));
  const markPaidOut = () => run((token) => billingApi.markPaidOut(id, token), t('toastSaved'));

  async function delInvoice() {
    if (!window.confirm(t('deleteConfirm'))) return;
    setBusy(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      await billingApi.deleteInvoice(id, token);
      router.push('/admin/billing/invoices');
    } catch { setToast({ msg: t('toastErr'), ok: false }); setBusy(false); }
  }

  async function downloadPdf() {
    const token = await getValidToken();
    if (!token) return;
    const blob = await billingApi.invoicePdf(id, token);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `faktura-${inv?.invoiceNumber ?? 'navrh'}.pdf`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="min-h-screen bg-cream dark:bg-gray-950 p-6"><Skeleton className="h-72" /></div>;
  if (error || !inv) return <div className="min-h-screen bg-cream dark:bg-gray-950 p-6"><ErrorState message={error ?? tb('errLoad')} /></div>;

  const isDraft = inv.status === 'DRAFT';
  const canSend = inv.status === 'FINALIZED';
  const lifecycle = inv.status !== 'DRAFT'; // FINALIZED a vyššie
  const docName = isDraft ? t('docDraft') : t('docFinal'); // DRAFT = Vyúčtovanie, inak Faktúra
  const statusBadge: Record<string, string> = {
    DRAFT: 'bg-amber-50 text-amber-700',
    FINALIZED: 'bg-blue-50 text-blue-700',
    SENT: 'bg-violet-50 text-violet-700',
    PAID: 'bg-emerald-50 text-emerald-700',
  };
  const dFull = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <Link href="/admin/billing/invoices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-coral dark:text-gray-400">
          <ArrowLeft size={15} /> {t('listTitle')}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {docName} {inv.invoiceNumber ?? t('noNumber')}
            </h1>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {t(`status.${inv.status}`)}
            </span>
            {inv.autoGenerated && <span className="mt-1 ml-1.5 inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">{t('autoBadge')}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadPdf}><FileDown size={15} className="mr-1.5" /> {isDraft ? t('downloadDraft') : t('downloadInvoice')}</Button>
            {isDraft && <Button onClick={finalize} loading={busy} disabled={busy}><Lock size={15} className="mr-1.5" /> {t('finalize')}</Button>}
            {canSend && <Button onClick={sendInv} loading={busy} disabled={busy}><Send size={15} className="mr-1.5" /> {t('send')}</Button>}
            {lifecycle && inv.status !== 'PAID' && <Button variant="outline" onClick={markPaid} disabled={busy}><CheckCircle2 size={15} className="mr-1.5" /> {t('markPaid')}</Button>}
            {lifecycle && !inv.paidOutAt && <Button variant="outline" onClick={markPaidOut} disabled={busy}><Banknote size={15} className="mr-1.5" /> {t('markPaidOut')}</Button>}
          </div>
        </div>

        {toast && <div className={`rounded-lg px-4 py-2 text-sm font-medium ${toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{toast.msg}</div>}
        {!isDraft && <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{t('lockedNote')}</div>}

        {lifecycle && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {inv.sentAt && <span>{t('sentAt')}: <span className="font-medium text-gray-700 dark:text-gray-300">{dFull(inv.sentAt)}</span></span>}
            {inv.paidAt && <span>{t('paidAt')}: <span className="font-medium text-gray-700 dark:text-gray-300">{dFull(inv.paidAt)}</span></span>}
            {inv.paidOutAt && <span>{t('paidOutAt')}: <span className="font-medium text-gray-700 dark:text-gray-300">{dFull(inv.paidOutAt)}</span></span>}
          </div>
        )}

        {/* Odberateľ */}
        <SectionCard title={t('buyer')}>
          <div className="text-sm text-gray-700 dark:text-gray-200">
            <div className="font-medium">{inv.buyerCompany || inv.buyerName}</div>
            {inv.buyerAddress && <div className="text-gray-500 dark:text-gray-400">{inv.buyerAddress}</div>}
            <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              {inv.buyerIco && <span className="mr-3">IČO: {inv.buyerIco}</span>}
              {inv.buyerDic && <span className="mr-3">DIČ: {inv.buyerDic}</span>}
              {inv.buyerIcDph && <span>IČ DPH: {inv.buyerIcDph}</span>}
            </div>
          </div>
        </SectionCard>

        {/* Položky */}
        <SectionCard title={t('items')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400">
                  <th className="py-2 pr-3 font-medium">{t('desc')}</th>
                  <th className="py-2 px-2 text-right font-medium">{t('qty')}</th>
                  <th className="py-2 px-2 text-right font-medium">{t('unitPrice')}</th>
                  <th className="py-2 px-2 text-right font-medium">{t('vat')}</th>
                  <th className="py-2 px-2 text-right font-medium">{t('lineTotal')}</th>
                  {isDraft && <th className="w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {inv.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">
                      {li.description}
                      <span className="ml-2 text-xs text-gray-400">{t(`type.${li.type}`)}</span>
                    </td>
                    <td className="px-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{li.quantity}</td>
                    <td className="px-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{eur(li.unitPriceCents)}</td>
                    <td className="px-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{li.vatPercent}%</td>
                    <td className="px-2 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{eur(li.lineTotalCents)}</td>
                    {isDraft && (
                      <td className="text-right">
                        {li.type === 'CUSTOM' && (
                          <button onClick={() => delItem(li.id)} disabled={busy} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pridať CUSTOM položku (len DRAFT) */}
          {isDraft && (
            <div className="mt-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                <Plus size={15} className="text-coral" /> {t('addItem')}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_70px_90px_70px_auto] sm:items-end">
                <label className="block"><span className="mb-1 block text-xs text-gray-500">{t('desc')}</span><Input value={aDesc} onChange={(e) => setADesc(e.target.value)} /></label>
                <label className="block"><span className="mb-1 block text-xs text-gray-500">{t('qty')}</span><Input type="number" min={1} value={aQty} onChange={(e) => setAQty(e.target.value)} /></label>
                <label className="block"><span className="mb-1 block text-xs text-gray-500">{t('unitPrice')}</span><Input type="number" step="0.01" value={aPrice} onChange={(e) => setAPrice(e.target.value)} /></label>
                <label className="block"><span className="mb-1 block text-xs text-gray-500">{t('vat')}</span><Input type="number" step="0.01" value={aVat} onChange={(e) => setAVat(e.target.value)} /></label>
                <Button variant="outline" onClick={addItem} disabled={busy}><Plus size={15} className="mr-1.5" /> {t('add')}</Button>
              </div>
            </div>
          )}

          {/* Súčty */}
          <div className="mt-4 space-y-1 border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="flex justify-between text-sm text-gray-500"><span>{t('subtotal')}</span><span className="tabular-nums">{eur(inv.subtotalCents)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>{t('vatTotal')}</span><span className="tabular-nums">{eur(inv.vatTotalCents)}</span></div>
            <div className="flex justify-between pt-1"><span className="font-semibold text-gray-900 dark:text-gray-100">{t('total')}</span><span className="text-lg font-bold text-coral tabular-nums">{eur(inv.totalCents)}</span></div>
          </div>
        </SectionCard>

        {/* Hlavička (DRAFT edit) */}
        <SectionCard title={docName}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">{t('taxDate')}</span><Input type="date" value={taxDate} onChange={(e) => setTaxDate(e.target.value)} disabled={!isDraft} /></label>
            <label className="block"><span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">{t('dueDate')}</span><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!isDraft} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">{t('note')}</span><Input value={note} onChange={(e) => setNote(e.target.value)} disabled={!isDraft} /></label>
          </div>
          {isDraft && (
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={saveHeader} loading={busy} disabled={busy}>{t('saveHeader')}</Button>
              <button onClick={delInvoice} disabled={busy} className="text-sm text-red-600 hover:underline">{t('deleteInvoice')}</button>
            </div>
          )}
        </SectionCard>

        {/* Výpis (informačné) */}
        <SectionCard title={t('stmtSection')}>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>{tb('ticketsSold')}</span><span className="tabular-nums">{inv.snapTicketsSold}</span></div>
            <div className="flex justify-between text-gray-500"><span>{tb('revenue')}</span><span className="tabular-nums">{eur(inv.snapRevenueCents)}</span></div>
            <div className="flex justify-between text-gray-500"><span>{tb('refundedTickets')}</span><span className="tabular-nums">{inv.snapRefundedTickets}</span></div>
            <div className="flex justify-between pt-1 border-t border-gray-100 dark:border-gray-800"><span className="font-semibold text-gray-900 dark:text-gray-100">{tb('netPayout')}</span><span className="font-bold tabular-nums">{eur(inv.snapNetPayoutCents)}</span></div>
          </div>
        </SectionCard>
      </main>
    </div>
  );
}
