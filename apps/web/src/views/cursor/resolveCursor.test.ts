import { describe, expect, it } from 'vitest';
import { resolveCursor } from './resolveCursor';

const html = (markup: string) => {
  document.body.innerHTML = markup;
  return (selector: string) => document.querySelector(selector);
};

describe('resolveCursor', () => {
  it('falls back to the default arrow on plain content', () => {
    const $ = html('<p id="t">hola</p>');
    expect(resolveCursor($('#t'))).toEqual({ variant: 'default', element: null, hint: null });
  });

  it('highlights buttons and uses aria-label as hint for icon-only ones', () => {
    const $ = html('<button aria-label="Cerrar"><svg id="t"></svg></button>');
    const target = resolveCursor($('#t'));
    expect(target.variant).toBe('pointer');
    expect(target.element).toBe($('button'));
    expect(target.hint).toBe('Cerrar');
  });

  it('does not hint buttons that already show text', () => {
    const $ = html('<button aria-label="Crear">Crear</button>');
    expect(resolveCursor($('button')).hint).toBeNull();
  });

  it('keeps the native caret on text fields', () => {
    const $ = html('<label><input id="t" type="text" /></label>');
    expect(resolveCursor($('#t')).variant).toBe('text');
  });

  it('shows the open hand over draggables, nearest rule wins', () => {
    const $ = html('<div aria-roledescription="tarjeta"><p id="t">Card</p></div>');
    expect(resolveCursor($('#t')).variant).toBe('grab');
  });

  it('ignores disabled controls', () => {
    const $ = html('<button disabled id="t">No</button>');
    expect(resolveCursor($('#t')).variant).toBe('default');
  });

  it('lets data-cursor override the inferred variant', () => {
    const $ = html('<button data-cursor="default" id="t">x</button>');
    expect(resolveCursor($('#t')).variant).toBe('default');
  });
});
