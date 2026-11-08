/** Joins truthy class names. Tiny on purpose: no need for a clsx dependency. */
export const cx = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');
