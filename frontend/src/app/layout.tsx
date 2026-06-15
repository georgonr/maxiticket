import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Krok 29: display serif pre marketingové nadpisy (self-hosted cez next/font, žiadny externý CDN).
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'TicketAll',
  description: 'Predaj vstupeniek online',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900 antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
