import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:   string;
  error?:   string;
  helper?:  string;
  icon?:    React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, helper, icon, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
              'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent',
              'disabled:bg-slate-50 disabled:text-slate-500',
              'transition-shadow duration-150',
              icon ? 'pl-9' : undefined,
              error && 'border-red-400 focus:ring-red-500',
              className,
            )}
            {...rest}
          />
        </div>
        {error  && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {helper && !error && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
