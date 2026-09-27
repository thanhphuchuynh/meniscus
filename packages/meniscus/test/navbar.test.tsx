// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { GlassNavbar, GlassProvider } from '../src';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.elementsFromPoint = (() => []) as unknown as typeof document.elementsFromPoint;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  document.body.innerHTML = '';
});

const settle = () => act(() => { for (let i = 0; i < 90; i++) vi.advanceTimersByTime(16); });
const tintOf = (el: HTMLElement) => Number(el.style.getPropertyValue('--meniscus-tint'));

it('is a named, sticky navigation capsule, and forwards its ref', () => {
  const ref = { current: null as HTMLElement | null };
  const { getByRole } = render(<GlassNavbar ref={ref} label="Main"><a href="#plates">Plates</a></GlassNavbar>);
  const nav = getByRole('navigation', { name: 'Main' });
  expect(ref.current).toBe(nav);
  expect(nav.style.position).toBe('sticky');
  expect(nav.style.top).toBe('12px');
  expect(nav.style.borderRadius).toBe('9999px');
});

it('stays clear at the top of the page and deepens once content scrolls under it', () => {
  const { getByRole } = render(<GlassNavbar label="Main">Links</GlassNavbar>);
  const nav = getByRole('navigation', { name: 'Main' });
  settle();
  expect(tintOf(nav)).toBeCloseTo(0.35, 2);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
  settle();
  expect(tintOf(nav)).toBeCloseTo(1, 2);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
  settle();
  expect(tintOf(nav)).toBeCloseTo(0.35, 2);
});

it('follows what is behind it by default; a provider or prop appearance wins', () => {
  const dark = document.createElement('section');
  dark.style.backgroundColor = 'rgb(0, 0, 0)';
  document.body.appendChild(dark);
  document.elementsFromPoint = (() => [dark]) as unknown as typeof document.elementsFromPoint;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 48, x: 0, y: 0, right: 300, bottom: 48, toJSON() {} } as DOMRect);
  const adaptive = render(<GlassNavbar label="Main">Links</GlassNavbar>);
  expect(adaptive.getByRole('navigation').getAttribute('data-meniscus-tone')).toBe('dark');
  adaptive.unmount();
  const provided = render(<GlassProvider appearance="light"><GlassNavbar label="Main">Links</GlassNavbar></GlassProvider>);
  expect(provided.getByRole('navigation').hasAttribute('data-meniscus-tone')).toBe(false);
  provided.unmount();
  const own = render(<GlassNavbar label="Main" appearance="dark">Links</GlassNavbar>);
  expect(own.getByRole('navigation').hasAttribute('data-meniscus-tone')).toBe(false);
});
