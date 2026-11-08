/** Renders the pixel confirmation requested through `confirm()` (see ../confirm.ts). */
import { Button } from './Button';
import { Modal } from './Modal';
import { settle, useConfirmStore } from '../confirm';

/** Renders the active confirmation, if any. Mount once near the app root. */
export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  return (
    <Modal open={request !== null} title="Confirmar" onClose={() => settle(false)}>
      {request && (
        <div className="flex flex-col gap-5">
          <p className="text-[15px] leading-snug">{request.message}</p>
          <footer className="flex justify-end gap-2">
            <Button onClick={() => settle(false)}>Cancelar</Button>
            <Button
              variant={request.danger ? 'danger' : 'primary'}
              autoFocus
              data-autofocus
              onClick={() => settle(true)}
            >
              {request.confirmLabel}
            </Button>
          </footer>
        </div>
      )}
    </Modal>
  );
}
