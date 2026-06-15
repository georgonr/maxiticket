'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { XCircle, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutCancelPage() {
  const t = useTranslations('checkout');
  return (
    <div className="mx-auto max-w-md text-center py-16">
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <XCircle size={48} className="text-red-500" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('cancelTitle')}</h1>
      <p className="text-gray-500 mb-8">{t('cancelDesc')}</p>
      <div className="flex flex-col gap-3">
        <Link href="/checkout">
          <Button size="lg" className="w-full gap-2">
            <ShoppingCart size={16} /> {t('backToCart')}
          </Button>
        </Link>
        <Link href="/events">
          <Button size="lg" variant="outline" className="w-full gap-2">
            <ArrowLeft size={16} /> {t('backToEvents')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
