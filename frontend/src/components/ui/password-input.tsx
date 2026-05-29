'use client';

import { forwardRef, useState, InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={show ? 'text' : 'password'}
            className={clsx(
              'w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm placeholder:text-gray-400',
              'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              className,
            )}
            {...props}
          />
          <button
            type="button"
            aria-label={show ? 'Skryť heslo' : 'Zobraziť heslo'}
            onClick={() => setShow((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-r-md"
          >
            {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
export { PasswordInput };
