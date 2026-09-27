// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassProvider, GlassSwitch } from '../src';
import { splitGlassOptions } from '../src/react/options';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () => act(() => { for (let i = 0; i < 90; i++) vi.advanceTimersByTime(16); });
const trackOf = (input: HTMLElement) => input.parentElement as HTMLElement;
const knobOf = (input: HTMLElement) => trackOf(input).querySelector('[data-meniscus]') as HTMLElement;
function sized(track: HTMLElement) {
  track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 52, height: 32, x: 0, y: 0, right: 52, bottom: 32, toJSON() {} }) as DOMRect;
}
function drag(track: HTMLElement, id: number, from: number, via: number, to: number) {
  fireEvent.pointerDown(track, { pointerId: id, button: 0, clientX: from });
  fireEvent.pointerMove(track, { pointerId: id, clientX: via });
  fireEvent.pointerMove(track, { pointerId: id, clientX: to });
  fireEvent.pointerUp(track, { pointerId: id, clientX: to });
}

it('is a native switch, named by its label, that toggles and submits', () => {
  const ref = { current: null as HTMLInputElement | null };
  const onChange = vi.fn();
  const { getByRole, getByText } = render(
    <form>
      <GlassSwitch ref={ref} label="Sound" name="sound" value="on" onChange={onChange} />
    </form>,
  );
  const input = getByRole('switch', { name: 'Sound' }) as HTMLInputElement;
  expect(ref.current).toBe(input);
  expect(input.type).toBe('checkbox');
  fireEvent.click(getByText('Sound'));
  expect(input.checked).toBe(true);
  expect(onChange).toHaveBeenCalledOnce();
  expect(new FormData(input.form!).get('sound')).toBe('on');
});

it('follows a controlled checked value, and keeps glass options off the input', () => {
  const { getByRole, rerender } = render(<GlassSwitch label="Sound" checked={false} tint="red" onChange={() => {}} />);
  const input = getByRole('switch') as HTMLInputElement;
  expect(input.checked).toBe(false);
  expect(input.hasAttribute('tint')).toBe(false);
  rerender(<GlassSwitch label="Sound" checked onChange={() => {}} />);
  expect(input.checked).toBe(true);
});

it('splits glass options from native props', () => {
  expect(splitGlassOptions({ tint: 'red', blur: undefined, name: 'sound', disabled: true })).toEqual([{ tint: 'red' }, { name: 'sound', disabled: true }]);
});

it('turns its knob into a clear lens while pressed', () => {
  const { getByRole } = render(<GlassSwitch label="Sound" />);
  const input = getByRole('switch');
  fireEvent.pointerDown(trackOf(input), { pointerId: 1, button: 0, clientX: 10 });
  settle();
  expect(Number(knobOf(input).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(0.15, 2);
  expect(knobOf(input).style.scale).toBe('1.35');
  fireEvent.pointerUp(trackOf(input), { pointerId: 1, clientX: 10 });
  settle();
  expect(Number(knobOf(input).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(1, 2);
});

it('toggles once when its knob is dragged across, and not when dragged back where it was', () => {
  const onChange = vi.fn();
  const { getByRole } = render(<GlassSwitch label="Sound" onChange={onChange} />);
  const input = getByRole('switch') as HTMLInputElement;
  const track = trackOf(input);
  sized(track);
  drag(track, 1, 8, 30, 48);
  expect(input.checked).toBe(true);
  expect(onChange).toHaveBeenCalledOnce();
  // The click a real pointer sends after the drag lands on the track, and is swallowed.
  fireEvent.click(track);
  expect(input.checked).toBe(true);
  act(() => vi.advanceTimersByTime(1));
  drag(track, 2, 48, 20, 44);
  expect(input.checked).toBe(true);
  expect(onChange).toHaveBeenCalledOnce();
});

it('ignores presses and drags while disabled, and doesn’t swell under reduced motion', () => {
  const onChange = vi.fn();
  const disabled = render(<GlassSwitch label="Sound" disabled onChange={onChange} />);
  const input = disabled.getByRole('switch') as HTMLInputElement;
  sized(trackOf(input));
  drag(trackOf(input), 1, 8, 30, 48);
  expect(input.checked).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
  disabled.unmount();
  const reduced = render(<GlassProvider reduceMotion><GlassSwitch label="Sound" /></GlassProvider>);
  const calm = reduced.getByRole('switch');
  fireEvent.pointerDown(trackOf(calm), { pointerId: 1, button: 0, clientX: 10 });
  expect(knobOf(calm).style.scale).toBe('1');
});
