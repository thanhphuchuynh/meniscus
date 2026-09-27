// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { Glass } from '../src';
import { overrideRefractionSupport } from '../src/core';

beforeEach(() => {
  overrideRefractionSupport(true);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 240 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 56 });
});

afterEach(() => {
  cleanup();
  overrideRefractionSupport(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('stays quiet about a faded parent outside the top layer', () => {
  vi.useFakeTimers();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // jsdom has no top layer: report the dialog as modal, as browsers do while it is open.
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
    if (selector.includes(':modal')) return this.tagName === 'DIALOG';
    return matches.call(this, selector);
  });
  render(
    <div style={{ opacity: 0.5 }}>
      <dialog open>
        <Glass>Inside</Glass>
      </dialog>
    </div>,
  );
  act(() => vi.advanceTimersByTime(1000));
  expect(warn).not.toHaveBeenCalled();
});
