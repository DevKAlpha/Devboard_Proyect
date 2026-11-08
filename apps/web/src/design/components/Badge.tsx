import type { ReactNode } from 'react';
import type { LabelColor } from '@devbord/shared';
import { cx } from '../cx';

/** Soft tinted pill for labels, card types and priorities (tint background, colored text). */
export function Badge({
  color = 'gray',
  children,
  className,
}: {
  color?: LabelColor;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center rounded-md px-1.5 text-[11px] leading-none font-semibold',
        className,
      )}
      style={{ background: `var(--label-${color})`, color: `var(--label-${color}-ink)` }}
    >
      {children}
    </span>
  );
}
