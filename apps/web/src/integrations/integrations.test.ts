import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCard, createBoard, createCard } from '@devbord/shared';
import { describeLink } from './links';
import { googleCalendarUrl, icsFile, nextDay, outlookCalendarUrl } from './calendar';
import { isSlackWebhook, moveMessage, readSlack, saveSlack } from './slack';
import { runTool } from './connections';
import { announceMove } from '../controllers/connectionsController';

describe('describeLink', () => {
  it('recognizes office files and work tools by URL', () => {
    expect(describeLink('https://docs.google.com/spreadsheets/d/x/edit')).toEqual({
      provider: 'google',
      service: 'Google Sheets',
    });
    expect(describeLink('https://drive.google.com/file/d/x/view').service).toBe('Google Drive');
    expect(describeLink('https://acme.sharepoint.com/:w:/r/sites/a/Doc.docx').service).toBe('Word');
    expect(describeLink('https://acme.sharepoint.com/sites/a').service).toBe('SharePoint');
    expect(describeLink('https://acme.slack.com/archives/C1/p2').provider).toBe('slack');
    expect(describeLink('https://example.org/a')).toEqual({
      provider: 'web',
      service: 'example.org',
    });
    expect(describeLink('no es url').provider).toBe('web');
  });
});

describe('calendar', () => {
  const event = { title: 'Entrega, v2', date: '2026-12-31', details: 'Línea 1\nLínea 2' };

  it('makes all-day events that end the next day', () => {
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(googleCalendarUrl(event)).toContain('dates=20261231%2F20270101');
    expect(outlookCalendarUrl(event)).toContain('startdt=2026-12-31');
    const ics = icsFile(event, 'c1');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('SUMMARY:Entrega\\, v2');
    expect(ics).toContain('DESCRIPTION:Línea 1\\nLínea 2');
  });
});

describe('slack', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  const webhook = 'https://hooks.slack.com/services/T0/B0/abc';

  it('keeps only real webhooks', () => {
    expect(isSlackWebhook(webhook)).toBe(true);
    expect(isSlackWebhook('https://evil.example/services/x')).toBe(false);
    saveSlack('b1', { webhook, notify: 'done' });
    expect(readSlack('b1')).toEqual({ webhook, notify: 'done' });
    saveSlack('b1', null);
    expect(readSlack('b1')).toBeNull();
  });

  it('escapes titles in the notice', () => {
    const text = moveMessage({
      boardName: 'Web',
      cards: [{ title: '<b>&', number: 3 }],
      to: 'Hecho',
      done: true,
    });
    expect(text).toBe(':white_check_mark: *Web* · #3 &lt;b&gt;&amp; pasó a *Hecho*');
  });

  it('announces only cards that change column, and respects "done only"', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetchMock);
    let board = createBoard({ name: 'B', profile: 'simple', columnTitles: ['A', 'B', 'C'] });
    const [a, b, c] = board.columns.map((col) => col.id) as [string, string, string];
    const card = createCard('Uno');
    board = addCard(board, a, card);

    announceMove(board, [card.id], b); // no channel yet
    expect(fetchMock).not.toHaveBeenCalled();

    saveSlack(board.id, { webhook, notify: 'done' });
    announceMove(board, [card.id], b); // not the last column
    announceMove(board, [card.id], a); // same column
    expect(fetchMock).not.toHaveBeenCalled();
    announceMove(board, [card.id], c);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toMatchObject([webhook, { method: 'POST', mode: 'no-cors' }]);
  });
});

describe('connection tools', () => {
  it('validate their input like MCP tools', async () => {
    await expect(runTool('slack', 'post_message', { text: 'hola' })).rejects.toThrow('boardId');
    await expect(runTool('google', 'nope', {})).rejects.toThrow('nope');
  });
});
