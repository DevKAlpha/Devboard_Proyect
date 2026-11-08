/**
 * Pixel-styled replacement for `window.confirm`.
 *
 * Native confirm dialogs are drawn by the OS (system font, no theme), which
 * breaks the all-pixel look. `confirm()` keeps the same one-line call site but
 * returns a Promise, and <ConfirmHost /> (mounted once in App) renders it.
 */
import { create } from 'zustand';

interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

export const useConfirmStore = create<{ request: ConfirmRequest | null }>(() => ({
  request: null,
}));

export interface ConfirmOptions {
  /** Text of the accept button. Default "Aceptar". */
  confirmLabel?: string;
  /** Red accept button, for destructive actions. */
  danger?: boolean;
}

/** Asks the user to confirm. Resolves true on accept, false on cancel/Escape. */
export function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  // A pending request is cancelled by a new one, so promises never hang.
  useConfirmStore.getState().request?.resolve(false);
  return new Promise((resolve) => {
    useConfirmStore.setState({
      request: {
        message,
        confirmLabel: options.confirmLabel ?? 'Aceptar',
        danger: options.danger ?? false,
        resolve,
      },
    });
  });
}

export const settle = (ok: boolean) => {
  const { request } = useConfirmStore.getState();
  useConfirmStore.setState({ request: null });
  request?.resolve(ok);
};
