import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Maxiticket Skener',
  description: 'Skener vstupeniek – inštalovateľná aplikácia',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MT Skener',
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
