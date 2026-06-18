// eKasa fiškalizácia POS (krok eKasa-F1) – provider-agnostický kontrakt.
// Implementácia: NineDigit (PORTOS) Expose HTTP API. Žiadne live volania pri builde.

export type EkasaItemType = 'positive' | 'discount' | 'returned' | 'correction';

export interface EkasaItem {
  type: EkasaItemType;
  name: string;
  quantity: number;
  unitPrice: number; // jednotková cena (2 desatinné); pri returned/correction záporná
  vatRate: number;   // DPH % lístka (Organizer.ticketVatPercent)
}

export interface EkasaPayment {
  name: string;   // „Hotovosť" / „Platobná karta"
  amount: number;
}

export interface EkasaSeller {
  id: string;
  type: 'ICDPH' | 'DIC';
}

/** Konfigurácia konkrétneho eKasa zariadenia (z EkasaDevice). */
export interface EkasaDeviceConfig {
  exposeUrl: string;
  accessToken: string;
  cashRegisterCode: string;
  printMode: string; // pos | pdf | email
}

/** Vstup pre registráciu dokladu (predaj alebo dobropis). */
export interface EkasaRegisterInput {
  externalId: string;          // = order.id (idempotencia)
  items: EkasaItem[];
  payments: EkasaPayment[];
  seller?: EkasaSeller;
  email?: { to: string; subject?: string; body?: string };
  // len pre dobropis/storno (F2):
  reference?: { receiptId: string };
}

export type EkasaResultStatus = 'REGISTERED' | 'OFFLINE' | 'FAILED';

/** Normalizovaný výsledok registrácie (mapuje sa na Order.ekasa* polia). */
export interface EkasaResult {
  status: EkasaResultStatus;
  receiptId: string | null;     // response.data.id
  okp: string | null;
  pkp: string | null;
  receiptNumber: string | null;
  error: string | null;
}

export interface EkasaProvider {
  registerSaleReceipt(input: EkasaRegisterInput, device: EkasaDeviceConfig): Promise<EkasaResult>;
  registerRefundReceipt(input: EkasaRegisterInput, device: EkasaDeviceConfig): Promise<EkasaResult>;
}

export const EKASA_PROVIDER = Symbol('EKASA_PROVIDER');
