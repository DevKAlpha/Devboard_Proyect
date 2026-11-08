import { useState } from 'react';
import type { Board } from '@devbord/shared';
import { Button, Input, PixelIcon, cx } from '../../design';
import { inviteLink, useCollab } from '../../controllers/collabController';
import { useIdentity } from '../../controllers/identityController';

const STATUS_TEXT = {
  idle: 'Sin conexión',
  connecting: 'Conectando…',
  online: 'En vivo',
  alone: 'Solo tú ahora',
} as const;

/** Pixel avatar: the person's initial on their cursor color. */
export function Avatar({ name, color, title }: { name: string; color: string; title?: string }) {
  return (
    <span
      title={title ?? name}
      className="grid size-7 place-items-center rounded-md border-2 border-surface font-pixel text-xs font-bold text-white shadow-card"
      style={{ background: color }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * Team header: live status, who is here (avatars) and the invite link.
 * Rendered only for team boards.
 */
export function TeamBar({ board }: { board: Board }) {
  const status = useCollab((s) => s.status);
  const peers = useCollab((s) => s.peers);
  const me = useIdentity();
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const others = Object.entries(peers);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(board));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context): show the link to copy by hand.
      setManual(true);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted" role="status">
        <span
          aria-hidden
          className={cx(
            'size-2 rounded-[2px]',
            status === 'online' ? 'animate-pulse' : status === 'connecting' ? 'opacity-50' : '',
          )}
          style={{
            background:
              status === 'online'
                ? 'var(--label-green-ink)'
                : status === 'alone'
                  ? 'var(--label-yellow-ink)'
                  : 'var(--faint)',
          }}
        />
        {STATUS_TEXT[status]}
      </span>

      <span
        className="flex -space-x-1.5"
        aria-label={`${others.length + 1} personas en el tablero`}
      >
        <Avatar name={me.name || 'Tú'} color={me.color} title={`${me.name || 'Tú'} (tú)`} />
        {others.map(([id, p]) => (
          <Avatar key={id} name={p.name} color={p.color} />
        ))}
      </span>

      <Button size="sm" onClick={() => void copy()}>
        <PixelIcon name="link" />
        {copied ? '¡Enlace copiado!' : 'Invitar'}
      </Button>
      {manual && (
        <Input
          readOnly
          autoFocus
          aria-label="Enlace de invitación"
          className="h-8 w-56 text-xs"
          value={inviteLink(board)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => setManual(false)}
        />
      )}
    </div>
  );
}
