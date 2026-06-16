import { BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';

/**
 * Krok 31e3: stabilný messageCode (+ params) pre verejné chybové hlášky.
 * Vzor z Doľaďováka 2 (coupon reasonCode): backend vracia kód POPRI pôvodnom
 * SK `message` (spätná kompatibilita – fallback ak konzument kód nepozná).
 *
 * NestJS HttpException s objektom → getResponse() vráti objekt verbatim;
 * AllExceptionsFilter ho zabalí do `message` → výsledok:
 *   body.message = { message: '<SK>', messageCode: '<CODE>', params?: {...} }
 */
type Params = Record<string, string | number>;

function payload(messageCode: string, message: string, params?: Params) {
  return params ? { message, messageCode, params } : { message, messageCode };
}

export function codedBadRequest(messageCode: string, message: string, params?: Params): BadRequestException {
  return new BadRequestException(payload(messageCode, message, params));
}

export function codedNotFound(messageCode: string, message: string, params?: Params): NotFoundException {
  return new NotFoundException(payload(messageCode, message, params));
}

export function codedConflict(messageCode: string, message: string, params?: Params): ConflictException {
  return new ConflictException(payload(messageCode, message, params));
}

export function codedForbidden(messageCode: string, message: string, params?: Params): ForbiddenException {
  return new ForbiddenException(payload(messageCode, message, params));
}
