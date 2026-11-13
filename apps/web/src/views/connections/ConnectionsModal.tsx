/**
 * "Conexiones": the work accounts and channels the board can use. Google and
 * Microsoft sign in for this tab (calendar events); Slack gets a webhook per
 * board (notices on card moves). Each one lists its tools, the same ones an
 * AI agent will be able to call.
 */
import { useEffect, useState } from 'react';
import type { Board } from '@devbord/shared';
import { Button, Field, Input, Modal, Select } from '../../design';
import { useConnections } from '../../controllers/connectionsController';
import { isConfigured, type AccountId } from '../../integrations/accounts';
import { CONNECTIONS, type Connection } from '../../integrations/connections';
import {
  isSlackWebhook,
  postToSlack,
  readSlack,
  saveSlack,
  type SlackConfig,
} from '../../integrations/slack';
import { ProviderMark } from './ProviderMark';

export function ConnectionsModal({
  board,
  open,
  onClose,
}: {
  board: Board;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title="Conexiones" onClose={onClose}>
      {open && <ConnectionList board={board} />}
    </Modal>
  );
}

function ConnectionList({ board }: { board: Board }) {
  const error = useConnections((s) => s.error);
  // Tokens expire; re-check each time the panel opens.
  useEffect(() => useConnections.getState().refresh(), []);

  return (
    <div className="flex flex-col gap-3">
      <p className="-mt-1 text-sm text-muted">
        Para adjuntar archivos de Google Drive, OneDrive o Slack no hace falta conectar nada: pega
        su enlace en la tarjeta.
      </p>
      {CONNECTIONS.map((c) => (
        <section key={c.id} className="rounded-xl border border-line-soft bg-surface-2 p-3">
          <header className="mb-1 flex items-center gap-2">
            <ProviderMark provider={c.id} size={12} />
            <h3 className="font-pixel text-base">{c.name}</h3>
            {c.id !== 'slack' && (
              <span className="ml-auto">
                <AccountStatus id={c.id} />
              </span>
            )}
          </header>
          <p className="text-sm text-muted">{c.description}</p>
          <Tools connection={c} />
          {c.id === 'slack' ? <SlackForm boardId={board.id} /> : <AccountActions id={c.id} />}
        </section>
      ))}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** The tools of a connection, as an agent would see them. */
function Tools({ connection }: { connection: Connection }) {
  return (
    <ul className="mt-2 flex flex-col gap-1 text-xs">
      {connection.tools.map((t) => (
        <li key={t.name} className="flex flex-wrap items-baseline gap-x-2">
          <code className="rounded bg-surface-3 px-1 py-px font-mono text-[11px] text-ink">
            {t.name}
          </code>
          <span className="text-faint">{t.description}</span>
        </li>
      ))}
    </ul>
  );
}

function AccountStatus({ id }: { id: AccountId }) {
  const on = useConnections((s) => s.signedIn[id]);
  if (!isConfigured(id)) return <span className="text-xs text-faint">Sin configurar</span>;
  return (
    <span className={on ? 'text-xs text-[var(--label-green-ink)]' : 'text-xs text-faint'}>
      {on ? 'Conectada' : 'Sin conectar'}
    </span>
  );
}

function AccountActions({ id }: { id: AccountId }) {
  const on = useConnections((s) => s.signedIn[id]);
  const busy = useConnections((s) => s.busy);
  const { connect, disconnect } = useConnections.getState();

  if (!isConfigured(id)) {
    return (
      <p className="mt-2 text-xs text-faint">
        Falta el Client ID de esta app en la configuración de Devbord (docs/integraciones.md).
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {on ? (
        <Button size="sm" onClick={() => disconnect(id)}>
          Desconectar
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          disabled={busy !== null}
          onClick={() => void connect(id)}
        >
          {busy === id ? 'Conectando…' : 'Conectar'}
        </Button>
      )}
      <span className="text-xs text-faint">La sesión dura mientras esta pestaña siga abierta.</span>
    </div>
  );
}

/** Slack channel of the board: an Incoming Webhook kept in this browser only. */
function SlackForm({ boardId }: { boardId: string }) {
  const [saved, setSaved] = useState<SlackConfig | null>(() => readSlack(boardId));
  const [webhook, setWebhook] = useState(saved?.webhook ?? '');
  const [notify, setNotify] = useState<SlackConfig['notify']>(saved?.notify ?? 'all');
  const [note, setNote] = useState<string | null>(null);
  const valid = isSlackWebhook(webhook);

  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const config = { webhook: webhook.trim(), notify };
        saveSlack(boardId, config);
        setSaved(config);
        setNote('Guardado. Los avisos salen desde este navegador.');
      }}
    >
      <Field label="Webhook del canal" htmlFor="slack-webhook">
        <Input
          id="slack-webhook"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://hooks.slack.com/services/…"
          value={webhook}
          onChange={(e) => {
            setWebhook(e.target.value);
            setNote(null);
          }}
        />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-56">
          <Field label="Avisar cuando" htmlFor="slack-notify">
            <Select
              id="slack-notify"
              className="h-8 text-sm"
              value={notify}
              onChange={(e) => setNotify(e.target.value === 'done' ? 'done' : 'all')}
            >
              <option value="all">Cambia de columna</option>
              <option value="done">Se termina (última columna)</option>
            </Select>
          </Field>
        </div>
        <Button size="sm" type="submit" variant="primary" disabled={!valid}>
          Guardar
        </Button>
        <Button
          size="sm"
          disabled={!valid}
          onClick={() =>
            void postToSlack(webhook.trim(), ':wave: Devbord está conectado a este canal.')
              .then(() => setNote('Mensaje de prueba enviado. Revisa el canal.'))
              .catch(() => setNote('No se pudo enviar. Revisa tu conexión.'))
          }
        >
          Probar
        </Button>
        {saved && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              saveSlack(boardId, null);
              setSaved(null);
              setWebhook('');
              setNote('Canal quitado.');
            }}
          >
            Quitar
          </Button>
        )}
      </div>
      <p className="text-xs text-faint" aria-live="polite">
        {note ??
          (webhook && !valid
            ? 'El webhook empieza por https://hooks.slack.com/services/'
            : 'En Slack: Apps › Incoming Webhooks › Añadir a un canal. Se guarda solo en este navegador; no se comparte con el equipo.')}
      </p>
    </form>
  );
}
