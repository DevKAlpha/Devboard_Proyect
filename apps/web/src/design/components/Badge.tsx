import type { ReactNode } from 'react';
import type { LabelColor } from '@devbord/shared';
import { cx } from '../cx';

/** Soft colored chip for labels, card types and priorities. */
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
        'inline-flex h-5 items-center px-1.5 text-[11px] leading-none font-semibold text-ink',
        className,
      )}
      style={{ background: `var(--label-${color})` }}
    >
      {children}
    </span>
  );
}
