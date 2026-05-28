import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maxiticket',
  description: 'Predaj vstupeniek online',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body className="min-h-screen bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
