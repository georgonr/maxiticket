'use client';

export interface CartItem {
  // GENERAL: ticketTypeId. SEATMAP/SECTIONED: terminSectionId. Práve jeden z dvoch.
  ticketTypeId?: string;
  terminSectionId?: string;
  quantity: number;
  name: string;
  price: number;
  currency: string;
}

export interface Cart {
  terminId: string;
  showSlug: string;
  showName: string;
  startsAt: string;
  timezone: string;
  venueName: string;
  city: string;
  items: CartItem[];
}

const KEY = 'mt_cart';

export function getCart(): Cart | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCart(cart: Cart | null) {
  if (typeof window === 'undefined') return;
  if (cart === null) {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, JSON.stringify(cart));
  }
}

export function clearCart() {
  setCart(null);
}

export function cartTotal(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}
