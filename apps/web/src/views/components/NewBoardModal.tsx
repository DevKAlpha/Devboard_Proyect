import { useState } from 'react';
import type { BoardMode, BoardSkin, Profile } from '@devbord/shared';
import { Button, Field, Input, Modal } from '../../design';
import { useBoardController } from '../../controllers/boardController';
import { usePreferences } from '../../controllers/preferencesController';
import { buildBoardFromTemplate, getTemplate, templatesFor } from '../../templates';
import { ModePicker, ProfilePicker, SkinPicker, TemplatePicker } from './Pickers';

export interface NewBoardModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => void;
}

/**
 * Board creation: personal or team, profile, template, then the look and the
 * name (required) at the bottom. Sensible defaults everywhere else.
 */
export function NewBoardModal({ open, onClose, onCreated }: NewBoardModalProps) {
  return (
    <Modal open={open} title="Nuevo tablero" onClose={onClose}>
      {/* Mounted only while open, so every opening starts from fresh defaults. */}
      {open && <NewBoardForm onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function NewBoardForm({ onClose, onCreated }: Omit<NewBoardModalProps, 'open'>) {
  const addBoard = useBoardController((s) => s.addBoard);
  const preferred = usePreferences((s) => s.profile);
  const [profile, setProfile] = useState<Profile>(preferred);
  const [templateId, setTemplateId] = useState(templatesFor(preferred)[0]!.id);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<BoardMode>('personal');
  const [skin, setSkin] = useState<BoardSkin>('default');
  const pickTemplate = setTemplateId;

  const changeProfile = (p: Profile) => {
    setProfile(p);
    pickTemplate(templatesFor(p)[0]!.id);
  };
  const template = getTemplate(templateId);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!template || !name.trim()) return;
        const board = await addBoard(
          buildBoardFromTemplate(template, { name, profile, mode, skin }),
        );
        onClose();
        onCreated(board.id);
      }}
    >
      <h3 className="-mb-3 text-xs font-semibold tracking-wide text-muted uppercase">
        ¿Para quién es?
      </h3>
      <ModePicker value={mode} onChange={setMode} />
      <h3 className="-mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Estilo</h3>
      <ProfilePicker value={profile} onChange={changeProfile} />
      <h3 className="-mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Plantilla</h3>
      <TemplatePicker
        templates={templatesFor(profile)}
        value={templateId}
        onChange={pickTemplate}
      />
      <h3 className="-mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Tema</h3>
      <SkinPicker value={skin} onChange={setSkin} />
      <Field label="Nombre" htmlFor="board-name">
        <Input
          id="board-name"
          required
          maxLength={80}
          placeholder={`Ej. ${template?.name ?? 'Mi tablero'}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Crear tablero
        </Button>
      </div>
    </form>
  );
}
