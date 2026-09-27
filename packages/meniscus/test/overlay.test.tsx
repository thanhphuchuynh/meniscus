// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Glass } from '../src';
import { useOpenState, useOverlay, type OverlayKind } from '../src/react/overlay';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

const frames = (n: number) => act(() => { for (let i = 0; i < n; i++) vi.advanceTimersByTime(16); });

function Harness({ open, kind = 'modal', onRequestClose = () => {}, trigger = null }: { open: boolean; kind?: OverlayKind; onRequestClose?: () => void; trigger?: HTMLElement | null }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const overlay = useOverlay(el, { open, onRequestClose, kind, trigger, dismiss: { escape: true, outside: kind === 'popover' } });
  const body = <Glass optics={overlay.optics} data-testid="glass"><button type="button">Inside</button></Glass>;
  return kind === 'modal' ? <dialog ref={setEl} data-shown={overlay.shown}>{body}</dialog> : <div ref={setEl} popover="manual" data-shown={overlay.shown}>{body}</div>;
}

const glassOpacity = () => Number(document.querySelector<HTMLElement>('[data-testid="glass"]')!.style.getPropertyValue('--meniscus-opacity'));

it('shows the dialog, then springs the glass in', () => {
  const { container, rerender } = render(<Harness open={false} />);
  const dialog = container.querySelector('dialog')!;
  expect(dialog.open).toBe(false);
  rerender(<Harness open />);
  expect(dialog.open).toBe(true);
  frames(60);
  expect(glassOpacity()).toBeCloseTo(1, 2);
});

it('keeps the dialog open until the glass has faded out, then hides it', () => {
  const { container, rerender } = render(<Harness open />);
  frames(60);
  const dialog = container.querySelector('dialog')!;
  rerender(<Harness open={false} />);
  let hidden = false;
  for (let i = 0; i < 120 && !hidden; i++) {
    frames(1);
    if (glassOpacity() > 0) expect(dialog.open).toBe(true);
    hidden = !dialog.open;
  }
  expect(hidden).toBe(true);
  expect(dialog.getAttribute('data-shown')).toBe('false');
});

it('turns around when reopened mid-exit, without hiding', () => {
  const { container, rerender } = render(<Harness open />);
  frames(60);
  rerender(<Harness open={false} />);
  frames(2);
  rerender(<Harness open />);
  const dialog = container.querySelector('dialog')!;
  for (let i = 0; i < 60; i++) {
    frames(1);
    expect(dialog.open).toBe(true);
  }
  expect(glassOpacity()).toBeCloseTo(1, 2);
});

it('turns a modal’s Escape into a close request', () => {
  const onRequestClose = vi.fn();
  const { container } = render(<Harness open onRequestClose={onRequestClose} />);
  const cancel = new Event('cancel', { cancelable: true });
  container.querySelector('dialog')!.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(onRequestClose).toHaveBeenCalledOnce();
});

it('closes a popover on Escape or an outside press', () => {
  const onRequestClose = vi.fn();
  render(<Harness open kind="popover" onRequestClose={onRequestClose} />);
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.body.dispatchEvent(escape);
  expect(escape.defaultPrevented).toBe(true);
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(onRequestClose).toHaveBeenCalledTimes(2);
});

it('gives Escape to the innermost popover only', () => {
  const outer = vi.fn();
  const inner = vi.fn();
  render(
    <>
      <Harness open kind="popover" onRequestClose={outer} />
      <Harness open kind="popover" onRequestClose={inner} />
    </>,
  );
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(inner).toHaveBeenCalledOnce();
  expect(outer).not.toHaveBeenCalled();
});

it('returns focus to the trigger when the overlay had it', () => {
  function WithTrigger({ open }: { open: boolean }) {
    const trigger = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button type="button" ref={trigger}>Open</button>
        <Harness open={open} trigger={trigger.current} />
      </>
    );
  }
  const { getByText, rerender } = render(<WithTrigger open={false} />);
  rerender(<WithTrigger open />);
  frames(30);
  getByText('Inside').focus();
  rerender(<WithTrigger open={false} />);
  frames(120);
  expect(document.activeElement).toBe(getByText('Open'));
});

it('locks page scroll while a modal shows, and releases it on close and on unmount', () => {
  const root = document.documentElement;
  const { rerender, unmount } = render(<Harness open />);
  expect(root.style.overflow).toBe('hidden');
  rerender(<Harness open={false} />);
  frames(120);
  expect(root.style.overflow).toBe('');
  rerender(<Harness open />);
  expect(root.style.overflow).toBe('hidden');
  unmount();
  expect(root.style.overflow).toBe('');
});

it('keeps controlled state with the parent and uncontrolled state inside', () => {
  const seen: boolean[] = [];
  function Probe({ open }: { open?: boolean }) {
    const [value, set] = useOpenState(open, true, (next) => seen.push(next));
    return <button type="button" onClick={() => set(!value)}>{String(value)}</button>;
  }
  const { getByRole, rerender } = render(<Probe />);
  act(() => getByRole('button').click());
  expect(getByRole('button').textContent).toBe('false');
  rerender(<Probe open />);
  act(() => getByRole('button').click());
  expect(getByRole('button').textContent).toBe('true');
  expect(seen).toEqual([false, false]);
});
