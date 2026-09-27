// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { luminance } from '../src/core/tone';
import { overrideSampler, sampleBackdrop, useBackdropTone } from '../src/react/tone';

type Box = { left: number; top: number; width: number; height: number };
function put(el: Element, r: Box) {
  el.getBoundingClientRect = () => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r }) as DOMRect;
}

let stack: Element[] = [];
const hit = vi.fn(() => stack);

beforeEach(() => {
  document.elementsFromPoint = hit as unknown as typeof document.elementsFromPoint;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  stack = [];
  hit.mockClear();
  overrideSampler(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function scene(html: string): HTMLElement {
  document.body.innerHTML = html;
  const glass = document.getElementById('glass')!;
  put(glass, { left: 0, top: 0, width: 100, height: 40 });
  return glass;
}

function image(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  for (const [key, value] of [['naturalWidth', width], ['naturalHeight', height], ['offsetWidth', width], ['offsetHeight', height]] as const) {
    Object.defineProperty(img, key, { value });
  }
  put(img, { left: 0, top: 0, width, height });
  return img;
}

function context(fill: number): CanvasRenderingContext2D {
  const data = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = fill;
    data[i + 3] = 255;
  }
  return { clearRect: vi.fn(), drawImage: vi.fn(), getImageData: vi.fn(() => ({ data })) } as unknown as CanvasRenderingContext2D;
}

it('reads the first solid background behind the glass, skipping glass and its content', () => {
  const glass = scene(
    '<section id="dark" style="background-color: rgb(10, 12, 16)"><div id="other" data-meniscus="refract" style="background-color: rgb(255, 255, 255)"></div><div id="glass" data-meniscus="frost"><span id="text">Hi</span></div></section>',
  );
  stack = [document.getElementById('text')!, glass, document.getElementById('other')!, document.getElementById('dark')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, null)).toBeCloseTo(luminance([10 / 255, 12 / 255, 16 / 255]), 6);
  expect(hit).toHaveBeenCalledTimes(5);
});

it('passes over colors under half opacity and falls back to the page canvas', () => {
  const glass = scene('<section id="veil" style="background-color: rgba(0, 0, 0, 0.3)"><div id="glass" data-meniscus="frost"></div></section>');
  stack = [glass, document.getElementById('veil')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, null)).toBe(1);
});

it('returns null when only a gradient or a background image is behind', () => {
  const glass = scene('<section id="hero" style="background-image: linear-gradient(black, navy)"><div id="glass" data-meniscus="frost"></div></section>');
  stack = [glass, document.getElementById('hero')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, null)).toBeNull();
});

it('averages a media backdrop’s pixels under the glass on an 8×8 canvas', () => {
  const glass = scene('<div id="glass" data-meniscus="frost"></div>');
  const img = image(200, 100);
  const ctx = context(64);
  overrideSampler(ctx);
  expect(sampleBackdrop(glass, img)).toBeCloseTo(luminance([64 / 255, 64 / 255, 64 / 255]), 6);
  expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0, 100, 40, 0, 0, 8, 8);
  expect(hit).not.toHaveBeenCalled();
});

it('treats a tainted canvas as unreadable and hit-tests the page instead', () => {
  const glass = scene('<section id="dark" style="background-color: rgb(0, 0, 0)"><div id="glass" data-meniscus="frost"></div></section>');
  overrideSampler({ clearRect() {}, drawImage() {}, getImageData() { throw new DOMException('tainted', 'SecurityError'); } } as unknown as CanvasRenderingContext2D);
  stack = [glass, document.getElementById('dark')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, image(200, 100))).toBe(0);
});

function Probe({ enabled = true }: { enabled?: boolean }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const tone = useBackdropTone(el, { enabled, backdrop: undefined, tint: null });
  return <div ref={setEl} data-meniscus="frost" data-tone={tone ?? 'none'} />;
}

it('samples on mount, then at most every 100 ms while the page scrolls', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 40, x: 0, y: 0, right: 100, bottom: 40, toJSON() {} } as DOMRect);
  const dark = document.createElement('section');
  dark.style.backgroundColor = 'rgb(0, 0, 0)';
  document.body.appendChild(dark);
  stack = [dark];
  const { container } = render(<Probe />);
  expect(container.querySelector('[data-tone]')!.getAttribute('data-tone')).toBe('dark');
  expect(hit).toHaveBeenCalledTimes(5);
  act(() => {
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(50);
  });
  expect(hit).toHaveBeenCalledTimes(5);
  act(() => vi.advanceTimersByTime(80));
  expect(hit).toHaveBeenCalledTimes(10);
});

it('never samples while disabled', () => {
  const { container } = render(<Probe enabled={false} />);
  expect(hit).not.toHaveBeenCalled();
  expect(container.querySelector('[data-tone]')!.getAttribute('data-tone')).toBe('none');
});

it('reads a background in a wider color syntax, such as oklch, from a painted pixel', () => {
  // Chromium, WebKit and jsdom keep oklch() in computed styles. A canvas paints it in sRGB.
  let fill = '#000000';
  const ctx = {
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      fill = v === '#000' ? '#000000' : v === '#fff' ? '#ffffff' : v;
    },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([21, 24, 29, 255]) })),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const glass = scene('<section id="hero" style="background-color: oklch(0.2 0.02 260)"><div id="glass" data-meniscus="frost"></div></section>');
  stack = [glass, document.getElementById('hero')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, null)).toBeCloseTo(luminance([21 / 255, 24 / 255, 29 / 255]), 6);
});
