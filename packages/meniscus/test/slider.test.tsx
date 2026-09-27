// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassSlider } from '../src';

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
const thumbOf = (input: HTMLElement) => input.parentElement!.querySelector('[data-meniscus]') as HTMLElement;

it('is a native range named by its label, with its value shown and read out', () => {
  const ref = { current: null as HTMLInputElement | null };
  const { getByRole, getByText } = render(<GlassSlider ref={ref} label="Refractive index" min={1} max={2.42} step={0.01} defaultValue={1.5} format={(v) => v.toFixed(2)} />);
  const slider = getByRole('slider', { name: 'Refractive index' }) as HTMLInputElement;
  expect(ref.current).toBe(slider);
  expect(slider.getAttribute('aria-valuetext')).toBe('1.50');
  expect(getByText('1.50').tagName).toBe('OUTPUT');
  fireEvent.change(slider, { target: { value: '2' } });
  expect(slider.getAttribute('aria-valuetext')).toBe('2.00');
  expect(slider.parentElement!.style.getPropertyValue('--meniscus-value')).toBe(String((2 - 1) / 1.42));
});

it('follows a controlled value', () => {
  const { getByRole, rerender } = render(<GlassSlider label="Depth" min={0} max={100} value={20} onChange={() => {}} />);
  const slider = getByRole('slider') as HTMLInputElement;
  expect(slider.value).toBe('20');
  rerender(<GlassSlider label="Depth" min={0} max={100} value={80} onChange={() => {}} />);
  expect(slider.value).toBe('80');
  expect(slider.parentElement!.style.getPropertyValue('--meniscus-value')).toBe('0.8');
});

it('turns its thumb into a lens while dragged, but not while disabled', () => {
  const { getByRole, rerender } = render(<GlassSlider label="Depth" />);
  const slider = getByRole('slider');
  fireEvent.pointerDown(slider, { pointerId: 1, button: 0 });
  settle();
  expect(Number(thumbOf(slider).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(0.15, 2);
  fireEvent.pointerUp(slider, { pointerId: 1 });
  settle();
  expect(Number(thumbOf(slider).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(1, 2);
  rerender(<GlassSlider label="Depth" disabled />);
  fireEvent.pointerDown(slider, { pointerId: 2, button: 0 });
  settle();
  expect(Number(thumbOf(slider).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(1, 2);
});
