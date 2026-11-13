/**
 * Files and pages attached to a card: paste a link from Google Drive, OneDrive,
 * SharePoint, Slack... and it shows as a chip with the service it belongs to.
 * Edits the card draft; nothing is saved until the card is.
 */
import { useState } from 'react';
import { CARD_LINKS_SIZE, CardLinkSchema, type CardLink } from '@devbord/shared';
import { Button, IconButton, Input } from '../../design';
import { describeLink } from '../../integrations/links';
import { ProviderMark } from './ProviderMark';

export function CardLinks({
  links,
  onChange,
}: {
  links: CardLink[];
  onChange: (links: CardLink[]) => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const full = links.length >= CARD_LINKS_SIZE;

  const add = () => {
    const clean = url.trim();
    if (!clean) return;
    const link = CardLinkSchema.safeParse({
      url: clean,
      title: (title.trim() || describeLink(clean).service).slice(0, 200),
    });
    if (!link.success) return setError('Pega un enlace completo, que empiece por https://');
    if (links.some((l) => l.url === link.data.url)) return setError('Ese enlace ya está adjunto.');
    onChange([...links, link.data]);
    setUrl('');
    setTitle('');
    setError(null);
  };

  // Enter adds the link instead of submitting (and closing) the card form.
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    add();
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        Archivos y enlaces
      </legend>
      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {links.map((l) => {
            const info = describeLink(l.url);
            return (
              <li
                key={l.url}
                className="flex items-center gap-2 rounded-lg border border-line-soft bg-card py-1 pr-1 pl-2.5 text-sm"
              >
                <ProviderMark provider={info.provider} />
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {l.title}
                </a>
                {/* Named links also say where they live; unnamed ones already do. */}
                {l.title !== info.service && (
                  <span className="shrink-0 text-xs text-faint">{info.service}</span>
                )}
                <IconButton
                  icon="close"
                  label={`Quitar ${l.title}`}
                  onClick={() => onChange(links.filter((x) => x.url !== l.url))}
                />
              </li>
            );
          })}
        </ul>
      )}
      {!full && (
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Enlace"
            type="url"
            inputMode="url"
            spellCheck={false}
            placeholder="Pega un enlace de Drive, OneDrive, Slack…"
            className="min-w-48 flex-[2]"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={onEnter}
          />
          <Input
            aria-label="Nombre (opcional)"
            placeholder="Nombre (opcional)"
            maxLength={200}
            className="min-w-32 flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onEnter}
          />
          <Button onClick={add} disabled={!url.trim()}>
            Adjuntar
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
