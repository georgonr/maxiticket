import { Injectable, Logger } from '@nestjs/common';
import {
  EkasaProvider, EkasaRegisterInput, EkasaDeviceConfig, EkasaResult, EkasaItem,
} from './ekasa.interface';

const TIMEOUT_MS = 8000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * NineDigit (PORTOS) Expose HTTP API.
 * POST {exposeUrl}/api/v1/requests/receipts/cash_register?access_token={token}
 * isSuccessful: true=online REGISTERED / null=OFFLINE / false=FAILED.
 * Žiadne volania pri builde – iba runtime za flagom EKASA_ENABLED.
 */
@Injectable()
export class NineDigitEkasaProvider implements EkasaProvider {
  private readonly logger = new Logger(NineDigitEkasaProvider.name);

  registerSaleReceipt(input: EkasaRegisterInput, device: EkasaDeviceConfig): Promise<EkasaResult> {
    return this.post(input, device);
  }

  /** Dobropis/storno – položky type 'returned' + referenceReceiptId. (F2: zatiaľ nenapojené.) */
  registerRefundReceipt(input: EkasaRegisterInput, device: EkasaDeviceConfig): Promise<EkasaResult> {
    return this.post(input, device);
  }

  private buildBody(input: EkasaRegisterInput, device: EkasaDeviceConfig) {
    const items = input.items.map((it: EkasaItem) => ({
      type: it.type,
      name: it.name,
      quantity: { amount: it.quantity, unit: 'ks' },
      unitPrice: round2(it.unitPrice),
      price: round2(it.unitPrice * it.quantity), // MUSÍ = unitPrice * quantity
      vatRate: it.vatRate,
      ...(input.seller ? { seller: { id: input.seller.id, type: input.seller.type } } : {}),
      ...(input.reference ? { referenceReceiptId: input.reference.receiptId } : {}),
    }));

    const print: Record<string, unknown> = { printerName: device.printMode };
    if (device.printMode === 'email' && input.email?.to) {
      print.options = {
        To: input.email.to,
        ...(input.email.subject ? { Subject: input.email.subject } : {}),
        ...(input.email.body ? { Body: input.email.body } : {}),
      };
    }

    return {
      request: {
        data: {
          cashRegisterCode: device.cashRegisterCode,
          externalId: input.externalId,
          items,
          payments: input.payments.map((p) => ({ name: p.name, amount: round2(p.amount) })),
        },
        externalId: input.externalId,
        print,
      },
    };
  }

  private async post(input: EkasaRegisterInput, device: EkasaDeviceConfig): Promise<EkasaResult> {
    const url = `${device.exposeUrl.replace(/\/$/, '')}/api/v1/requests/receipts/cash_register?access_token=${encodeURIComponent(device.accessToken)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildBody(input, device)),
        signal: controller.signal,
      });
      const json: any = await res.json().catch(() => ({}));
      return this.parse(json, res.ok ? null : `HTTP ${res.status}`);
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? `timeout ${TIMEOUT_MS}ms` : (e as Error).message;
      this.logger.error(`eKasa request failed (${input.externalId}): ${msg}`);
      return { status: 'FAILED', receiptId: null, okp: null, pkp: null, receiptNumber: null, error: msg };
    } finally {
      clearTimeout(timer);
    }
  }

  private parse(json: any, transportError: string | null): EkasaResult {
    const isSuccessful = json?.isSuccessful;
    const status = isSuccessful === true ? 'REGISTERED' : isSuccessful === null ? 'OFFLINE' : 'FAILED';
    const reqData = json?.request?.data ?? {};
    const errObj = json?.error;
    const error = errObj ? `${errObj.code ?? ''}: ${errObj.message ?? ''}`.trim() : transportError;
    return {
      status: transportError && isSuccessful === undefined ? 'FAILED' : status,
      receiptId: json?.response?.data?.id ?? null,
      okp: reqData.okp ?? null,
      pkp: reqData.pkp ?? null,
      receiptNumber: reqData.receiptNumber != null ? String(reqData.receiptNumber) : null,
      error: status === 'FAILED' ? (error || 'eKasa registrácia zlyhala') : null,
    };
  }
}
