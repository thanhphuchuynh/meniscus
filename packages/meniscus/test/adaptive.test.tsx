// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { Glass, GlassProvider } from '../src';
import { VARIANTS } from '../src/core/glass';

let stack: Element[] = [];

function behind(css: string) {
  const section = document.createElement('section');
  section.style.cssText = css;
  document.body.appendChild(section);
  stack = [section];
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.elementsFromPoint = (() => stack) as unknown as typeof document.elementsFromPoint;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 48, x: 0, y: 0, right: 200, bottom: 48, toJSON() {} } as DOMRect);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 200 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 48 });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  stack = [];
  vi.restoreAllMocks();
});

it('turns dark over dark content, with light ink and the dark tint', () => {
  behind('background-color: rgb(8, 10, 14)');
  const { container } = render(<Glass appearance="adaptive">Menu</Glass>);
  const glass = container.firstElementChild as HTMLElement;
  expect(glass.getAttribute('data-meniscus-tone')).toBe('dark');
  expect(glass.style.color).toContain('--meniscus-ink-on-dark');
  expect(glass.style.backgroundColor).toBe(VARIANTS.regular.darkTint.replace(/\s+/g, ' '));
});

it('turns light over light content', () => {
  behind('background-color: rgb(250, 250, 248)');
  const { container } = render(<Glass appearance="adaptive">Menu</Glass>);
  expect(container.firstElementChild!.getAttribute('data-meniscus-tone')).toBe('light');
});

it('stays as auto, setting no ink, when nothing behind can be read', () => {
  behind('background-image: linear-gradient(black, navy)');
  const { container } = render(<Glass appearance="adaptive">Menu</Glass>);
  const glass = container.firstElementChild as HTMLElement;
  expect(glass.hasAttribute('data-meniscus-tone')).toBe(false);
  expect(glass.style.color).toBe('');
});

it("keeps the app's own color", () => {
  behind('background-color: rgb(8, 10, 14)');
  const { container } = render(<Glass appearance="adaptive" style={{ color: 'red' }}>Menu</Glass>);
  expect((container.firstElementChild as HTMLElement).style.color).toBe('red');
});

it('takes adaptive from a provider, and never samples glass that is not toned', () => {
  behind('background-color: rgb(8, 10, 14)');
  const spy = vi.fn(() => stack);
  document.elementsFromPoint = spy as unknown as typeof document.elementsFromPoint;
  const { container, rerender } = render(<GlassProvider appearance="adaptive"><Glass>Menu</Glass></GlassProvider>);
  expect(container.querySelector('[data-meniscus-tone="dark"]')).not.toBeNull();
  spy.mockClear();
  rerender(<Glass>Plain</Glass>);
  expect(spy).not.toHaveBeenCalled();
});
