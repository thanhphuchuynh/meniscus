// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { Glass, GlassGroup, GlassIndicator } from '../src';
import { computeRefractionProfile, createUnionMaps, overrideRefractionSupport, type RGBAImage } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

function place(el: HTMLElement, box: { left: number; top: number; width: number; height: number }) {
  Object.defineProperties(el, {
    offsetLeft: { configurable: true, get: () => box.left },
    offsetTop: { configurable: true, get: () => box.top },
    offsetWidth: { configurable: true, get: () => box.width },
    offsetHeight: { configurable: true, get: () => box.height },
  });
  el.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => box });
}

function reduceMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on && query.includes('reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

let frames: FrameRequestCallback[] = [];
let clock = 0;
function flushFrames(count = 400) {
  for (let i = 0; i < count && frames.length; i++) {
    const run = frames;
    frames = [];
    clock += 16;
    for (const f of run) f(clock);
  }
}

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    frames.push(f);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

beforeEach(() => {
  clock = performance.now();
  reduceMotion(false);
});

afterEach(() => {
  cleanup();
  frames = [];
  overrideRefractionSupport(undefined);
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe('createUnionMaps', () => {
  const profile = computeRefractionProfile({ bezel: 12, thickness: 12, ior: 1.5 });
  const light = { angle: -45, elevation: 18, specular: 0.8, rim: 0.7 };
  const alpha = (img: RGBAImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3]!;

  /** Two 40 px drops side by side, `gap` apart, and the pixel halfway between them. */
  function drops(gap: number, smoothing: number) {
    const size = 40;
    const maps = createUnionMaps({
      shapes: [
        { x: 8, y: 8, width: size, height: size, radius: size / 2 },
        { x: 8 + size + gap, y: 8, width: size, height: size, radius: size / 2 },
      ],
      width: 16 + 2 * size + gap,
      height: 16 + size,
      smoothing,
      bezel: 12,
      profile,
      lighting: profile,
      light,
      pixelScale: 1,
    });
    return { maps, mid: { x: Math.floor(8 + size + gap / 2), y: 8 + size / 2 } };
  }

  it('grows a neck between outlines closer than the smoothing distance', () => {
    const { maps, mid } = drops(20, 24);
    expect(alpha(maps.displacement, mid.x, mid.y)).toBe(255);
  });

  it('leaves outlines farther apart than the smoothing distance separate', () => {
    const { maps, mid } = drops(28, 24);
    expect(alpha(maps.displacement, mid.x, mid.y)).toBe(0);
  });

  it('never merges at zero smoothing', () => {
    const { maps, mid } = drops(6, 0);
    expect(alpha(maps.displacement, mid.x, mid.y)).toBe(0);
  });

  it('keeps the waist of a neck free of a crease', () => {
    // A shallow neck, so its waist sits where the bezel bends light hardest.
    const { maps, mid } = drops(20, 24);
    const shift = (x: number) => maps.displacement.data[(mid.y * maps.displacement.width + x) * 4]! - 127.5;
    const across = Array.from({ length: 21 }, (_, i) => Math.abs(shift(48 + i)));
    const peak = Math.max(...across);
    expect(peak).toBeGreaterThan(20);
    // Where the two outlines pull the normal opposite ways, the shift passes
    // through zero instead of flipping sign at full strength.
    expect(Math.abs(shift(mid.x) - shift(mid.x - 1))).toBeLessThan(peak / 2);
  });
});

describe('<GlassIndicator>', () => {
  function tabs() {
    const a = document.createElement('button');
    const b = document.createElement('button');
    document.body.append(a, b);
    place(a, { left: 0, top: 4, width: 80, height: 32 });
    place(b, { left: 200, top: 4, width: 80, height: 32 });
    return { a, b };
  }

  it('stays hidden until it has a target', () => {
    mockSize(0, 0);
    const { container } = render(<GlassIndicator target={null} />);
    const el = container.querySelector<HTMLElement>('[data-meniscus-indicator]')!;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.visibility).toBe('hidden');
  });

  it('jumps to its first target, then stretches toward the next and settles on it', () => {
    mockSize(0, 0);
    const { a, b } = tabs();
    const { container, rerender } = render(<GlassIndicator target={a} />);
    const el = container.querySelector<HTMLElement>('[data-meniscus-indicator]')!;
    // The first placement waits a frame, for ancestors to finish positioning.
    expect(el.style.visibility).toBe('hidden');
    act(() => flushFrames(1));
    expect(el.style.visibility).toBe('visible');
    expect([el.style.left, el.style.width, el.style.top, el.style.height]).toEqual(['0px', '80px', '4px', '32px']);

    rerender(<GlassIndicator target={b} />);
    act(() => flushFrames(4));
    // The leading edge runs ahead of the trailing one, so the glass is wider than either tab…
    expect(parseFloat(el.style.width)).toBeGreaterThan(80);
    // …and thinner, keeping its volume.
    expect(parseFloat(el.style.height)).toBeLessThan(32);

    act(() => flushFrames());
    expect([el.style.left, el.style.width, el.style.top, el.style.height]).toEqual(['200px', '80px', '4px', '32px']);
  });

  it('jumps instead of gliding when its coordinate space changes', () => {
    mockSize(0, 0);
    const { a } = tabs();
    const { container, rerender } = render(<GlassIndicator target={a} />);
    act(() => flushFrames(1));
    const el = container.querySelector<HTMLElement>('[data-meniscus-indicator]')!;
    // An ancestor starts positioning itself, so offsets now measure from it.
    const parent = document.createElement('div');
    Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => parent });
    Object.defineProperty(a, 'offsetParent', { configurable: true, get: () => parent });
    place(a, { left: 120, top: 4, width: 80, height: 32 });
    rerender(<GlassIndicator target={a} inset={0.5} />);
    expect(el.style.left).toBe('120.5px');
    expect(frames).toHaveLength(0);
  });

  it('follows a box as well as an element, for dragging', () => {
    mockSize(0, 0);
    const { a } = tabs();
    const { container, rerender } = render(<GlassIndicator target={a} />);
    act(() => flushFrames(1));
    rerender(<GlassIndicator target={{ x: 130, y: 4, width: 80, height: 32 }} />);
    act(() => flushFrames());
    const el = container.querySelector<HTMLElement>('[data-meniscus-indicator]')!;
    expect([el.style.left, el.style.width]).toEqual(['130px', '80px']);
  });

  it('moves straight to the target with reduced motion', () => {
    reduceMotion(true);
    mockSize(0, 0);
    const { a, b } = tabs();
    const { container, rerender } = render(<GlassIndicator target={a} />);
    act(() => flushFrames(1));
    rerender(<GlassIndicator target={b} />);
    const el = container.querySelector<HTMLElement>('[data-meniscus-indicator]')!;
    expect(el.style.left).toBe('200px');
    expect(frames).toHaveLength(0);
  });
});

describe('<GlassGroup>', () => {
  function Drops({ second = true }: { second?: boolean }) {
    return (
      <GlassGroup spacing={24} data-testid="group">
        <Glass data-testid="a">A</Glass>
        {second ? <Glass data-testid="b">B</Glass> : null}
      </GlassGroup>
    );
  }

  function layout(container: HTMLElement) {
    const group = container.querySelector<HTMLElement>('[data-testid="group"]')!;
    place(group, { left: 0, top: 0, width: 40, height: 40 });
    const a = container.querySelector<HTMLElement>('[data-testid="a"]');
    const b = container.querySelector<HTMLElement>('[data-testid="b"]');
    if (a) place(a, { left: 0, top: 0, width: 40, height: 40 });
    if (b) place(b, { left: 46, top: 0, width: 40, height: 40 });
    return group;
  }

  async function settle() {
    await act(async () => {
      flushFrames(30);
      await Promise.resolve();
    });
  }

  it('draws its members as one surface instead of glass of their own', async () => {
    overrideRefractionSupport(true);
    mockSize(40, 40);
    const { container } = render(<Drops />);
    const group = layout(container);
    for (const id of ['a', 'b']) {
      const member = container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
      expect(member.dataset.meniscus).toBe('none');
      expect(member.style.boxShadow).toBe('');
      expect(member.querySelector('filter')).toBeNull();
    }
    expect(group.dataset.meniscusGroup).toBe('refract');

    await settle();
    const surface = group.querySelector<HTMLElement>('[data-meniscus-layer="surface"]')!;
    expect(surface.style.visibility).toBe('visible');
    expect(surface.style.maskImage).toContain('data:image/png');
    expect(surface.style.backdropFilter).toMatch(/^url\(#meniscus-group-/);
    // Both drops plus the reach of the bulge (spacing / 2) and 2 px on each side.
    expect(surface.style.width).toBe(`${86 + 28}px`);
    expect(group.querySelector<HTMLElement>('[data-meniscus-layer="highlight"]')!.style.backgroundImage).toContain('data:image/png');
  });

  it('redraws without a member once it unmounts', async () => {
    mockSize(40, 40);
    const { container, rerender } = render(<Drops />);
    const group = layout(container);
    await settle();
    rerender(<Drops second={false} />);
    layout(container);
    await settle();
    expect(group.querySelector<HTMLElement>('[data-meniscus-layer="surface"]')!.style.width).toBe(`${40 + 28}px`);
  });
});

describe('<Glass appear>', () => {
  it('stays hidden until it can be measured', () => {
    mockSize(0, 0);
    const { container } = render(<Glass appear>Hi</Glass>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.opacity).toBe('0');
    expect(el.hasAttribute('appear')).toBe(false);
  });

  it('fades and swells in while the lens gathers its bend', () => {
    overrideRefractionSupport(true);
    mockSize(160, 48);
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { container } = render(<Glass appear>Hi</Glass>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.opacity).toBe('');
    const keyframes = animate.mock.calls.map(([k]) => Object.keys(k[0])[0]);
    expect(keyframes).toEqual(['opacity', 'scale']);

    const map = el.querySelector('feDisplacementMap')!;
    const full = map.getAttribute('data-scale');
    expect(Number(full)).toBeGreaterThan(0);
    expect(map.getAttribute('scale')).toBe('0');
    flushFrames();
    expect(map.getAttribute('scale')).toBe(full);
  });

  it('only fades with reduced motion', () => {
    reduceMotion(true);
    overrideRefractionSupport(true);
    mockSize(160, 48);
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { container } = render(<Glass appear>Hi</Glass>);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(Object.keys(animate.mock.calls[0]![0][0])).toEqual(['opacity']);
    const map = (container.firstElementChild as HTMLElement).querySelector('feDisplacementMap')!;
    expect(map.getAttribute('scale')).toBe(map.getAttribute('data-scale'));
  });
});
