// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { within } from '@testing-library/react';
import { GlassToaster, toast } from '../src';

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

afterEach(() => {
  act(() => toast.dismiss());
});

const regionOf = (view: ReturnType<typeof render>) => view.getByRole('region', { name: 'Notifications' });
const texts = (region: HTMLElement) => within(region).queryAllByRole('listitem').map((li) => li.querySelector('strong')!.textContent);

it('shows a toast with its description and action, announces it, and shows the region', () => {
  const undo = vi.fn();
  const view = render(<GlassToaster />);
  act(() => {
    toast('Plate saved', { description: 'In your collection.', action: { label: 'Undo', onClick: undo } });
  });
  const region = regionOf(view);
  expect(texts(region)).toEqual(['Plate saved']);
  expect(region.hasAttribute('data-test-popover-open')).toBe(true);
  expect(view.getByRole('status').textContent).toBe('Plate saved In your collection.');
  fireEvent.click(within(region).getByRole('button', { name: 'Undo' }));
  expect(undo).toHaveBeenCalledOnce();
  settle();
  expect(texts(region)).toEqual([]);
  expect(region.hasAttribute('data-test-popover-open')).toBe(false);
});

it('leaves after its duration, pauses while hovered, and Infinity stays', () => {
  const view = render(<GlassToaster />);
  act(() => {
    toast('Short', { duration: 1000 });
    toast('Forever', { duration: Infinity });
  });
  const region = regionOf(view);
  fireEvent.pointerEnter(region);
  act(() => vi.advanceTimersByTime(3000));
  expect(texts(region)).toEqual(['Short', 'Forever']);
  fireEvent.pointerLeave(region);
  act(() => vi.advanceTimersByTime(1100));
  settle();
  expect(texts(region)).toEqual(['Forever']);
});

it('shows three at most, newest last; the rest wait their turn', () => {
  const view = render(<GlassToaster />);
  let ids: string[] = [];
  act(() => {
    ids = ['One', 'Two', 'Three', 'Four'].map((n) => toast(n, { duration: Infinity }));
  });
  const region = regionOf(view);
  expect(texts(region)).toEqual(['Two', 'Three', 'Four']);
  act(() => toast.dismiss(ids[3]));
  settle();
  expect(texts(region)).toEqual(['One', 'Two', 'Three']);
});

it('replaces a toast that reuses an id, in place', () => {
  const view = render(<GlassToaster />);
  act(() => {
    toast('Uploading…', { id: 'upload', duration: Infinity });
    toast('Uploaded', { id: 'upload', duration: Infinity });
  });
  expect(texts(regionOf(view))).toEqual(['Uploaded']);
});

it('can be dismissed from its own button', () => {
  const view = render(<GlassToaster />);
  act(() => {
    toast('Plate saved', { duration: Infinity });
  });
  // Found while it holds a toast: an empty region is hidden, and hidden elements have no role to find.
  const region = regionOf(view);
  fireEvent.click(view.getByRole('button', { name: 'Dismiss notification' }));
  settle();
  expect(texts(region)).toEqual([]);
});

it('keeps toasts made before any toaster mounts, and starts their clocks on mount', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => {
    toast('Early', { duration: 1000 });
  });
  act(() => vi.advanceTimersByTime(5000));
  expect(warn.mock.calls.some(([m]) => String(m).includes('GlassToaster'))).toBe(true);
  const view = render(<GlassToaster />);
  const region = regionOf(view);
  expect(texts(region)).toEqual(['Early']);
  act(() => vi.advanceTimersByTime(1100));
  settle();
  expect(texts(region)).toEqual([]);
});
