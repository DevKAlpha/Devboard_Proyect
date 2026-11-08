import { useState } from 'react';
import { Button, Field, Input, Modal } from '../../design';
import { useIdentity } from '../../controllers/identityController';
import { Avatar } from './TeamBar';

/**
 * Asks for a display name the first time someone opens a team board, so
 * teammates see who is who (name on the cursor and the avatar).
 */
export function NamePrompt() {
  const name = useIdentity((s) => s.name);
  const color = useIdentity((s) => s.color);
  const setName = useIdentity((s) => s.setName);
  const [draft, setDraft] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const save = (value: string) => {
    setName(value.trim() || 'Invitado');
    setDismissed(true);
  };

  return (
    <Modal open={!name && !dismissed} title="¿Cómo te llamas?" onClose={() => save(draft)}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(draft);
        }}
      >
        <p className="text-sm text-muted">
          Tu equipo verá este nombre junto a tu cursor. Solo se guarda en este navegador.
        </p>
        <div className="flex items-end gap-3">
          <Avatar name={draft || '?'} color={color} />
          <div className="flex-1">
            <Field label="Tu nombre" htmlFor="identity-name">
              <Input
                id="identity-name"
                autoFocus
                data-autofocus
                maxLength={30}
                placeholder="Ej. Ana"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <Button type="submit" variant="primary" className="self-end">
          Entrar al tablero
        </Button>
      </form>
    </Modal>
  );
}
