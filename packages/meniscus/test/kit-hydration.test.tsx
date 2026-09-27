// @vitest-environment jsdom
import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Kit } from './fixtures/kit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.elementsFromPoint = (() => []) as unknown as typeof document.elementsFromPoint;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

it('hydrates the whole kit from server HTML without a mismatch', async () => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Kit />);
  document.body.appendChild(container);
  const recoverable: unknown[] = [];
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let root: Root | undefined;
  await act(async () => {
    root = hydrateRoot(container, <Kit />, { onRecoverableError: (error) => recoverable.push(error) });
  });
  expect(recoverable).toEqual([]);
  expect(errors.mock.calls.filter(([m]) => /hydrat/i.test(String(m)))).toEqual([]);
  act(() => root!.unmount());
});

it('hydrates the switch and slider where the browser has linear() easing and the server doesn’t', async () => {
  // A Node server has no CSS global; a browser with linear() gets a traced spring for the knob and thumb.
  vi.resetModules();
  vi.stubGlobal('CSS', undefined);
  const server = await import('../src');
  const html = renderToString(<><server.GlassSwitch label="Sound" /><server.GlassSlider label="Opacity" /></>);
  vi.resetModules();
  vi.stubGlobal('CSS', { supports: (property: string, value?: string) => property === 'transition-timing-function' && !!value?.startsWith('linear(') });
  const browser = await import('../src');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, <><browser.GlassSwitch label="Sound" /><browser.GlassSlider label="Opacity" /></>);
    });
    expect(errors.mock.calls.filter(([m]) => /hydrat/i.test(String(m)))).toEqual([]);
    expect(container.querySelector<HTMLElement>('[role="switch"]')!.parentElement!.querySelector<HTMLElement>('[data-meniscus]')!.style.transition).toContain('linear(');
  } finally {
    act(() => root?.unmount());
    vi.unstubAllGlobals();
  }
});
