// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassTooltip } from '../src';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

/** Runs the springs for about 1.5 s: long enough for any entrance or exit to finish. */
const settle = () => { for (let i = 0; i < 90; i++) act(() => { vi.advanceTimersByTime(16); }); };

// jsdom can't tell keyboard focus from other focus: treat every focus as keyboard focus.
vi.mock('../src/react/focus', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/react/focus')>()), focusVisible: () => true }));

function Save() {
  return (
    <GlassTooltip content="Save to collection">
      <button type="button">Save</button>
    </GlassTooltip>
  );
}

const tipOf = (button: HTMLElement) => document.getElementById(button.getAttribute('aria-describedby')!)!;
const isOpen = (tip: HTMLElement) => tip.hasAttribute('data-test-popover-open');

it('describes its element, and shows only after the hover delay', () => {
  const { getByRole } = render(<Save />);
  const button = getByRole('button', { name: 'Save' });
  const tip = tipOf(button);
  expect(tip.getAttribute('role')).toBe('tooltip');
  expect(tip.textContent).toBe('Save to collection');
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(400));
  expect(isOpen(tip)).toBe(false);
  act(() => vi.advanceTimersByTime(150));
  expect(isOpen(tip)).toBe(true);
});

it('lets the pointer cross onto it, then hides once the pointer leaves', () => {
  const { getByRole } = render(<Save />);
  const button = getByRole('button', { name: 'Save' });
  const tip = tipOf(button);
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(600));
  fireEvent.pointerLeave(button, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(50));
  fireEvent.pointerEnter(tip, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(300));
  expect(isOpen(tip)).toBe(true);
  fireEvent.pointerLeave(tip, { pointerType: 'mouse' });
  settle();
  expect(isOpen(tip)).toBe(false);
});

it('never shows for touch', () => {
  const { getByRole } = render(<Save />);
  const button = getByRole('button', { name: 'Save' });
  fireEvent.pointerEnter(button, { pointerType: 'touch' });
  act(() => vi.advanceTimersByTime(2000));
  expect(isOpen(tipOf(button))).toBe(false);
});

it('shows at once on keyboard focus, and hides on Escape and on blur', () => {
  const { getByRole } = render(<Save />);
  const button = getByRole('button', { name: 'Save' });
  const tip = tipOf(button);
  act(() => button.focus());
  expect(isOpen(tip)).toBe(true);
  fireEvent.keyDown(button, { key: 'Escape' });
  settle();
  expect(isOpen(tip)).toBe(false);
  act(() => button.blur());
  act(() => button.focus());
  expect(isOpen(tip)).toBe(true);
  act(() => button.blur());
  settle();
  expect(isOpen(tip)).toBe(false);
});

it('shows the next tooltip at once when moving between them', () => {
  const { getByRole } = render(
    <>
      <GlassTooltip content="First"><button type="button">One</button></GlassTooltip>
      <GlassTooltip content="Second"><button type="button">Two</button></GlassTooltip>
    </>,
  );
  const one = getByRole('button', { name: 'One' });
  const two = getByRole('button', { name: 'Two' });
  fireEvent.pointerEnter(one, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(600));
  fireEvent.pointerLeave(one, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(120));
  fireEvent.pointerEnter(two, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(16));
  expect(isOpen(tipOf(two))).toBe(true);
});
