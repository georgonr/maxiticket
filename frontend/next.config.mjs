import createNextIntlPlugin from 'next-intl/plugin';

// Krok 31a: next-intl plugin (request config). Locale routing len pre public subdoménu (middleware).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.ticketall.eu' },
    ],
  },
};

export default withNextIntl(nextConfig);
