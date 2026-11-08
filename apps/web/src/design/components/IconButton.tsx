import { forwardRef } from 'react';
import { Button, type ButtonProps } from './Button';
import { PixelIcon, type IconName } from './PixelIcon';
import { cx } from '../cx';

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: IconName;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'sm', className, ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cx(size === 'sm' ? 'w-8 px-0' : 'w-10 px-0', className)}
      {...rest}
    >
      <PixelIcon name={icon} />
    </Button>
  );
});
