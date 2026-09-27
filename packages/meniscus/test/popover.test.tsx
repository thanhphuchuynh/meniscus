// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassDialog, GlassPopover } from '../src';

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
const settle = () => act(() => { for (let i = 0; i < 90; i++) vi.advanceTimersByTime(16); });

function Share(props: { onOpenChange?: (open: boolean) => void }) {
  return (
    <GlassPopover label="Share" trigger={<button type="button">Share</button>} {...props}>
      <button type="button">Copy link</button>
    </GlassPopover>
  );
}

it('wires its trigger to a named popover and toggles on click', () => {
  const { getByRole } = render(<Share />);
  const trigger = getByRole('button', { name: 'Share' });
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  fireEvent.click(trigger);
  const surface = document.getElementById(trigger.getAttribute('aria-controls')!)!;
  expect(surface.getAttribute('role')).toBe('dialog');
  expect(surface.getAttribute('aria-label')).toBe('Share');
  expect(surface.getAttribute('popover')).toBe('manual');
  expect(surface.hasAttribute('data-test-popover-open')).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(trigger);
  settle();
  expect(surface.hasAttribute('data-test-popover-open')).toBe(false);
});

it('moves focus in, and Escape closes it and gives focus back', () => {
  const { getByRole } = render(<Share />);
  const trigger = getByRole('button', { name: 'Share' });
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(getByRole('button', { name: 'Copy link' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  settle();
  expect(document.activeElement).toBe(trigger);
});

it('closes on an outside press and when focus leaves', () => {
  const onOpenChange = vi.fn();
  const { getByRole } = render(
    <>
      <Share onOpenChange={onOpenChange} />
      <button type="button">Elsewhere</button>
    </>,
  );
  fireEvent.click(getByRole('button', { name: 'Share' }));
  fireEvent.pointerDown(document.body);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  fireEvent.click(getByRole('button', { name: 'Share' }));
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  act(() => getByRole('button', { name: 'Elsewhere' }).focus());
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

it('takes Escape inside an open dialog without closing the dialog', () => {
  const dialogChange = vi.fn();
  const popoverChange = vi.fn();
  const { getByRole, container } = render(
    <GlassDialog label="Settings" open onOpenChange={dialogChange}>
      <Share onOpenChange={popoverChange} />
    </GlassDialog>,
  );
  fireEvent.click(getByRole('button', { name: 'Share' }));
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  getByRole('button', { name: 'Copy link' }).dispatchEvent(escape);
  expect(escape.defaultPrevented).toBe(true);
  expect(popoverChange).toHaveBeenLastCalledWith(false);
  expect(dialogChange).not.toHaveBeenCalled();
  expect(container.querySelector('dialog')!.open).toBe(true);
});
