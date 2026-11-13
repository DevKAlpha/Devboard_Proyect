/**
 * Sends a card's due date to a calendar. With the account connected the event
 * is created directly (through the connection's tool); otherwise Google and
 * Outlook open their "new event" screen prefilled, and the .ics file covers
 * every other calendar app.
 */
import { useState } from 'react';
import { Button, PixelIcon } from '../../design';
import { useConnections } from '../../controllers/connectionsController';
import type { AccountId } from '../../integrations/accounts';
import {
  googleCalendarUrl,
  icsFile,
  outlookCalendarUrl,
  type CalendarEvent,
} from '../../integrations/calendar';
import { runTool } from '../../integrations/connections';

/** Calendar URLs carry the details in the query; keep them short. */
const DETAILS_MAX = 500;

export function CardCalendar({
  cardId,
  title,
  date,
  description,
}: {
  cardId: string;
  title: string;
  date: string;
  description: string;
}) {
  const signedIn = useConnections((s) => s.signedIn);
  const [status, setStatus] = useState<{ text: string; link?: string } | null>(null);
  const event: CalendarEvent = {
    title,
    date,
    details: [description.slice(0, DETAILS_MAX), `Tarjeta en Devbord: ${window.location.href}`]
      .filter(Boolean)
      .join('\n\n'),
  };

  const send = (id: AccountId, fallbackUrl: string) => {
    if (!signedIn[id]) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setStatus({ text: 'Creando el evento…' });
    runTool(id, 'create_calendar_event', { ...event })
      .then((link) => setStatus({ text: 'Evento creado.', link }))
      .catch((e: unknown) => {
        setStatus({ text: e instanceof Error ? e.message : 'No se pudo crear el evento.' });
        useConnections.getState().refresh();
      });
  };

  const download = () => {
    const blob = new Blob([icsFile(event, cardId)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'tarjeta'}.ics`;
    a.click();
    // Revoke later: some browsers start the download after click() returns.
    setTimeout(() => URL.revokeObjectURL(a.href), 1_000);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        Llevar la fecha al calendario
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => send('google', googleCalendarUrl(event))}>
          <PixelIcon name="calendar" />
          Google Calendar
        </Button>
        <Button size="sm" onClick={() => send('microsoft', outlookCalendarUrl(event))}>
          <PixelIcon name="calendar" />
          Outlook
        </Button>
        <Button size="sm" variant="ghost" onClick={download}>
          <PixelIcon name="download" />
          Archivo .ics
        </Button>
      </div>
      {status && (
        <p className="text-xs text-muted" aria-live="polite">
          {status.text}{' '}
          {status.link && (
            <a href={status.link} target="_blank" rel="noopener noreferrer" className="underline">
              Abrir
            </a>
          )}
        </p>
      )}
    </div>
  );
}
