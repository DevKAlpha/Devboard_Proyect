import { useState } from 'react';
import type { Profile } from '@devbord/shared';
import { Button, Field, Input, Modal } from '../../design';
import { useBoardController } from '../../controllers/boardController';
import { usePreferences } from '../../controllers/preferencesController';
import { buildBoardFromTemplate, getTemplate, templatesFor } from '../../templates';
import { ProfilePicker, TemplatePicker } from './Pickers';

export interface NewBoardModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => void;
}

/** Board creation: profile + template + optional name. Sensible defaults everywhere. */
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

  const changeProfile = (p: Profile) => {
    setProfile(p);
    setTemplateId(templatesFor(p)[0]!.id);
  };
  const template = getTemplate(templateId);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!template) return;
        const board = await addBoard(buildBoardFromTemplate(template, { name, profile }));
        onClose();
        onCreated(board.id);
      }}
    >
      <ProfilePicker value={profile} onChange={changeProfile} />
      <TemplatePicker
        templates={templatesFor(profile)}
        value={templateId}
        onChange={setTemplateId}
      />
      <Field label="Nombre (opcional)" htmlFor="board-name">
        <Input
          id="board-name"
          maxLength={80}
          placeholder={template?.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary">
          Crear tablero
        </Button>
      </div>
    </form>
  );
}
