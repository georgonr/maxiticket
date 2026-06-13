'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Prepínač svetlý/tmavý režim (next-themes).
 * Mount-guard zabráni hydration mismatchu (theme je známy až na klientovi).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? 'Prepnúť na svetlý režim' : 'Prepnúť na tmavý režim'}
      title={isDark ? 'Svetlý režim' : 'Tmavý režim'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
        'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
        'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        className,
      )}
    >
      {/* Pred mountom render stabilnej ikony (žiadny mismatch) */}
      {mounted && isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
