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
