import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size    = 'sm' | 'md' | 'lg';

const variantStyles: Record<Variant, string> = {
  primary:   'bg-blue-700 hover:bg-blue-800 text-white shadow-sm',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800',
  danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm',
  ghost:     'hover:bg-slate-100 text-slate-700',
  outline:   'border border-slate-300 hover:bg-slate-50 text-slate-700',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
};

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  icon?:     React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  children, variant = 'primary', size = 'md',
  loading, icon, fullWidth, className, disabled, ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" className="text-current" /> : icon}
      {children}
    </button>
  );
}
