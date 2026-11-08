import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink shadow-card hover:brightness-110',
  secondary: 'border border-line-soft bg-card text-ink shadow-card hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-3/70 hover:text-ink',
  danger: 'bg-danger text-white shadow-card hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5',
  md: 'h-10 px-4 text-[15px] gap-2',
};

/**
 * Base button: soft Apple-style surface. The "press" feedback is a stepped
 * 1px sink, a nod to the pixel keys of the first version.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg font-medium select-none',
        'transition-[transform,filter,background-color] duration-100',
        'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});
