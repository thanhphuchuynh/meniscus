// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassButton, GlassDialog, GlassProvider, GlassSlider, GlassSwitch } from '../src';

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

const panelOf = (container: HTMLElement) => container.querySelector('dialog [data-meniscus]') as HTMLElement;

it('opens from its trigger, names itself, and moves focus to the first control', () => {
  const { getByRole, container } = render(
    <GlassDialog label="Order a print" trigger={<GlassButton>Order</GlassButton>}>
      <label>Email <input name="email" /></label>
      <button type="button">Cancel</button>
    </GlassDialog>,
  );
  const trigger = getByRole('button', { name: 'Order' });
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  const dialog = container.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  expect(dialog.getAttribute('aria-label')).toBe('Order a print');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(container.querySelector('input'));
});

it('asks to close on Escape; a controlled dialog that ignores it stays open', () => {
  const onOpenChange = vi.fn();
  const { container } = render(<GlassDialog label="Filters" open onOpenChange={onOpenChange}>Body</GlassDialog>);
  const dialog = container.querySelector('dialog')!;
  const cancel = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  settle();
  expect(dialog.open).toBe(true);
});

it('closes when the dimmed page is clicked, and gives focus back to the trigger', () => {
  const { getByRole, container } = render(
    <GlassDialog label="Filters" trigger={<button type="button">Filters</button>}>
      <button type="button">Apply</button>
    </GlassDialog>,
  );
  fireEvent.click(getByRole('button', { name: 'Filters' }));
  settle();
  fireEvent.click(container.querySelector('[data-meniscus-scrim]')!);
  settle();
  expect(container.querySelector('dialog')!.open).toBe(false);
  expect(document.activeElement).toBe(getByRole('button', { name: 'Filters' }));
});

it('closes on a form method="dialog" submit, keeping the submitter’s value', () => {
  const onOpenChange = vi.fn();
  const { getByRole, container } = render(
    <GlassDialog label="Confirm" defaultOpen onOpenChange={onOpenChange}>
      <form method="dialog">
        <button value="ok">OK</button>
      </form>
    </GlassDialog>,
  );
  const dialog = container.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  fireEvent.click(getByRole('button', { name: 'OK' }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  settle();
  expect(dialog.open).toBe(false);
  expect(dialog.returnValue).toBe('ok');
});

it('focuses the panel when nothing inside can take focus', () => {
  const { container } = render(<GlassDialog label="Notice" defaultOpen>Saved.</GlassDialog>);
  const panel = panelOf(container);
  expect(document.activeElement).toBe(panel);
  expect(panel.tabIndex).toBe(-1);
});

it('reports a close the browser made by itself, and opens again normally', () => {
  const onOpenChange = vi.fn();
  const { getByRole, container } = render(
    <GlassDialog label="Filters" trigger={<button type="button">Filters</button>} onOpenChange={onOpenChange}>Body</GlassDialog>,
  );
  const trigger = getByRole('button', { name: 'Filters' });
  fireEvent.click(trigger);
  settle();
  const dialog = container.querySelector('dialog')!;
  act(() => dialog.close());
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  expect(dialog.open).toBe(true);
});

it('shows a controlled dialog again when the browser closes it and the parent keeps it open', () => {
  const onOpenChange = vi.fn();
  const { container } = render(<GlassDialog label="Terms" open onOpenChange={onOpenChange}>Body</GlassDialog>);
  settle();
  const dialog = container.querySelector('dialog')!;
  // Chrome's close watcher closes a dialog on a second Escape without a cancelable cancel event.
  act(() => dialog.close());
  expect(onOpenChange).toHaveBeenCalledWith(false);
  settle();
  expect(dialog.open).toBe(true);
});

it('lets the page scroll again when unmounted mid-exit', () => {
  const root = document.documentElement;
  const { rerender, unmount } = render(<GlassDialog label="A" open>Body</GlassDialog>);
  expect(root.style.overflow).toBe('hidden');
  rerender(<GlassDialog label="A" open={false}>Body</GlassDialog>);
  act(() => vi.advanceTimersByTime(32));
  unmount();
  expect(root.style.overflow).toBe('');
});

it('slides a sheet up, with a grabber that drags it away', () => {
  const onOpenChange = vi.fn();
  const { container } = render(<GlassDialog label="Filters" placement="bottom" open onOpenChange={onOpenChange}>Body</GlassDialog>);
  const panel = panelOf(container);
  expect(panel.style.translate).toContain('var(--meniscus-presence');
  Object.defineProperty(panel, 'offsetHeight', { configurable: true, value: 400 });
  settle();
  const grabber = container.querySelector('[data-meniscus-grabber]') as HTMLElement;
  fireEvent.pointerDown(grabber, { pointerId: 1, button: 0, clientY: 300 });
  fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 360 });
  fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 460 });
  fireEvent.pointerUp(grabber, { pointerId: 1, clientY: 460 });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it('slides a drawer in from its side, keeps vertical scrolling, and holds still under reduced motion', () => {
  const { container } = render(<GlassDialog label="Library" placement="left" open>Links</GlassDialog>);
  const panel = panelOf(container);
  expect(panel.style.translate).toContain('(var(--meniscus-presence, 1) - 1)');
  expect(panel.style.touchAction).toBe('pan-y');
  cleanup();
  const reduced = render(
    <GlassProvider reduceMotion>
      <GlassDialog label="Library" placement="left" open>Links</GlassDialog>
    </GlassProvider>,
  );
  expect(panelOf(reduced.container).style.translate).toBe('');
});

it('leaves drags that start on a control inside a drawer to the control', () => {
  const onOpenChange = vi.fn();
  const { container, getByRole } = render(
    <GlassDialog label="Library" placement="left" open onOpenChange={onOpenChange}>
      <input aria-label="Search" defaultValue="plates" />
      <GlassSlider label="Opacity" />
      <GlassSwitch label="Sound" />
    </GlassDialog>,
  );
  settle();
  const panel = panelOf(container);
  const track = getByRole('switch', { name: 'Sound' }).parentElement!;
  for (const target of [getByRole('textbox', { name: 'Search' }), getByRole('slider', { name: 'Opacity' }), track]) {
    fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 120, clientY: 100 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 20, clientY: 100 });
  }
  expect(panel.style.getPropertyValue('--meniscus-drag')).toBe('');
  expect(onOpenChange).not.toHaveBeenCalled();
});

it('warns in development when it has no accessible name', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<GlassDialog>Body</GlassDialog>);
  expect(warn.mock.calls.some(([m]) => String(m).includes('accessible name'))).toBe(true);
});
