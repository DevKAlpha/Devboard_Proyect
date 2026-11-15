/**
 * Shown when archiving with MAX_ARCHIVED_BOARDS already archived: the person
 * picks an archived board to delete (it can be downloaded first), and then the
 * board they wanted to archive is archived.
 */
import { MAX_ARCHIVED_BOARDS } from '@devbord/shared';
import { Button, IconButton, Modal, confirm } from '../../design';
import { archivedBoards, useBoardController } from '../../controllers/boardController';
import { removeBoard } from '../../controllers/boardLifecycle';
import { downloadBoardJson } from '../board/downloadBoard';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export function ArchiveFullModal({
  open,
  boardName,
  onClose,
  onFreed,
}: {
  open: boolean;
  /** The board waiting to be archived. */
  boardName: string;
  onClose: () => void;
  /** Called once an archived board was deleted: there is room again. */
  onFreed: () => void;
}) {
  const boards = useBoardController((s) => s.boards);
  const archived = archivedBoards(boards);

  return (
    <Modal open={open} title="Archivados llenos" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-snug">
          Ya tienes {MAX_ARCHIVED_BOARDS} tableros archivados, el máximo. Elige uno para eliminarlo
          y archivar "{boardName}". Puedes descargarlo antes en JSON.
        </p>
        <ul className="flex flex-col gap-1.5">
          {archived.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-2 rounded-lg border border-line-soft bg-card px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{b.name}</span>
              <span className="shrink-0 text-xs text-faint">
                {dateFormat.format(new Date(b.archivedAt ?? b.updatedAt))}
              </span>
              <IconButton
                icon="download"
                label={`Descargar "${b.name}" en JSON`}
                onClick={() => downloadBoardJson(b)}
              />
              <IconButton
                icon="trash"
                label={`Eliminar "${b.name}"`}
                onClick={async () => {
                  const ok = await confirm(
                    `¿Eliminar el tablero archivado "${b.name}" y archivar "${boardName}"? No se puede deshacer.`,
                    { confirmLabel: 'Eliminar y archivar', danger: true },
                  );
                  if (!ok) return;
                  await removeBoard(b);
                  onFreed();
                }}
              />
            </li>
          ))}
        </ul>
        <footer className="flex justify-end">
          <Button onClick={onClose}>Cancelar</Button>
        </footer>
      </div>
    </Modal>
  );
}
