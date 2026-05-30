import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'TicketAll Skener',
  description: 'Skener vstupeniek – inštalovateľná aplikácia',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TicketAll Skener',
  },
};

export const viewport: Viewport = {
  themeColor: '#e63946',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
