import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink pixel-raised hover:brightness-110',
  secondary: 'bg-surface text-ink pixel-raised hover:bg-surface-2',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger text-white pixel-raised hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5',
  md: 'h-10 px-4 text-[15px] gap-2',
};

/**
 * Pixel button. "Press" feedback is a 2px translate that collapses the hard
 * shadow, like a physical key.
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
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-medium select-none',
        'transition-[transform,filter,background-color] duration-100',
        'active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});
