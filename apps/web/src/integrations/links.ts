/**
 * Recognizes office files and work tools from their URL, so a pasted link
 * shows as "Google Sheets" or "Word" with the service's color, without
 * connecting any account.
 */

/** Who a link belongs to. Drives the chip color; "web" is anything else. */
export type LinkProvider = 'google' | 'microsoft' | 'slack' | 'web';

export interface LinkInfo {
  provider: LinkProvider;
  /** Product name shown on the chip ("Google Docs", "Excel"...). */
  service: string;
}

/** Google: the app is the first path segment of docs.google.com. */
const GOOGLE_DOCS: Record<string, string> = {
  document: 'Google Docs',
  spreadsheets: 'Google Sheets',
  presentation: 'Google Slides',
  forms: 'Google Forms',
  drawings: 'Google Drawings',
};

const GOOGLE_HOSTS: Record<string, string> = {
  'drive.google.com': 'Google Drive',
  'calendar.google.com': 'Google Calendar',
  'meet.google.com': 'Google Meet',
  'mail.google.com': 'Gmail',
};

/** Office web links name the app in the path (":w:", "/x/") or a query. */
const OFFICE_APPS: [RegExp, string][] = [
  [/(\/:w:\/|\bWord\b|\.docx?\b)/i, 'Word'],
  [/(\/:x:\/|\bExcel\b|\.xlsx?\b)/i, 'Excel'],
  [/(\/:p:\/|\bPowerPoint\b|\.pptx?\b)/i, 'PowerPoint'],
];

/** What a URL points to. Never throws: unknown or invalid URLs are "web". */
export function describeLink(raw: string): LinkInfo {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { provider: 'web', service: 'Enlace' };
  }
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'docs.google.com') {
    const app = url.pathname.split('/')[1] ?? '';
    return { provider: 'google', service: GOOGLE_DOCS[app] ?? 'Google Docs' };
  }
  const google = GOOGLE_HOSTS[host];
  if (google) return { provider: 'google', service: google };

  if (
    host.endsWith('sharepoint.com') ||
    host === 'onedrive.live.com' ||
    host === '1drv.ms' ||
    host.endsWith('office.com') ||
    host.endsWith('officeapps.live.com')
  ) {
    const app = OFFICE_APPS.find(([re]) => re.test(url.pathname + url.search))?.[1];
    if (app) return { provider: 'microsoft', service: app };
    if (host.startsWith('outlook.')) return { provider: 'microsoft', service: 'Outlook' };
    return {
      provider: 'microsoft',
      service: host.endsWith('sharepoint.com') ? 'SharePoint' : 'OneDrive',
    };
  }
  if (host === 'teams.microsoft.com' || host === 'teams.live.com') {
    return { provider: 'microsoft', service: 'Teams' };
  }
  if (host.startsWith('outlook.')) return { provider: 'microsoft', service: 'Outlook' };

  if (host === 'slack.com' || host.endsWith('.slack.com')) {
    return { provider: 'slack', service: 'Slack' };
  }
  return { provider: 'web', service: host };
}
