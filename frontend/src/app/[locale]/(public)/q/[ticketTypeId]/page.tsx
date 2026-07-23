import { getQrInfoSSR } from '@/lib/events.server';
import { QrBuyClient } from './QrBuyClient';

/**
 * Krok 50 (V5): QR scan-to-buy – údaje o type lístka a cene sa načítajú NA SERVERI
 * (SSR), takže sú v úvodnom HTML aj pri blokovanom api.*. Interaktivita v QrBuyClient.
 */
export default async function QrBuyPage({
  params,
  searchParams,
}: {
  params: { ticketTypeId: string };
  searchParams: { qty?: string };
}) {
  const res = await getQrInfoSSR(params.ticketTypeId);
  return (
    <QrBuyClient
      ticketTypeId={params.ticketTypeId}
      initialInfo={res.status === 'ok' ? res.data : null}
      loadStatus={res.status}
      qtyParam={Number(searchParams.qty)}
    />
  );
}
