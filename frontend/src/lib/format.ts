export function formatDate(isoString: string, timezone = 'Europe/Bratislava', opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('sk-SK', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(new Date(isoString));
}

export function formatPrice(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency }).format(amount);
}
