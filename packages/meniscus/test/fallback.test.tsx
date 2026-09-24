// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { Glass, GlassGroup } from '../src';
import {
  computeRefractionProfile,
  lightVector,
  overrideElementCopy,
  overrideElementImage,
  overrideRefractionSupport,
  overrideUnionWorker,
  overrideWebGL2,
  shadeSurface,
  unionJob,
  unionKernel,
  type UnionInput,
} from '../src/core';
import { fitRect } from '../src/webgl/media';
import { resolveTint, tintVersion } from '../src/webgl/color';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

function place(el: HTMLElement, box: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => box });
}

let frames: FrameRequestCallback[] = [];
let clock = 0;
function flushFrames(count = 40) {
  for (let i = 0; i < count && frames.length; i++) {
    const run = frames;
    frames = [];
    clock += 16;
    for (const f of run) f(clock);
  }
}

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    frames.push(f);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  frames = [];
  overrideRefractionSupport(undefined);
  overrideElementCopy(undefined);
  overrideElementImage(undefined);
  overrideUnionWorker(undefined);
  overrideWebGL2(undefined);
  vi.unstubAllGlobals();
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    frames.push(f);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

const profile = computeRefractionProfile({ bezel: 16, thickness: 16, ior: 1.5 });
const input: UnionInput = {
  shapes: [
    { x: 8, y: 8, width: 64, height: 40, radius: 20 },
    { x: 80, y: 8, width: 40, height: 40, radius: 20 },
  ],
  width: 128,
  height: 56,
  smoothing: 12,
  bezel: 16,
  profile,
  lighting: profile,
  light: { angle: -45, elevation: 18, specular: 0.8, rim: 0.7, shade: 0.35 },
  pixelScale: 1,
};

describe('unionKernel', () => {
  it('runs from its own source text, as it does inside the worker', () => {
    const rebuilt = new Function(`return (${unionKernel.toString()})`)() as typeof unionKernel;
    const job = unionJob(input);
    const a = unionKernel(job);
    const b = rebuilt(job);
    expect(b.width).toBe(a.width);
    expect(Buffer.from(b.disp).equals(Buffer.from(a.disp))).toBe(true);
    expect(Buffer.from(b.glow).equals(Buffer.from(a.glow))).toBe(true);
  });

  it('lights the merged outline exactly as shadeSurface does', () => {
    const job = unionJob({ ...input, shapes: [input.shapes[0]!] });
    const px = unionKernel(job);
    // A pixel 3.5 px inside the top edge of the first shape.
    const x = 40;
    const y = 11;
    const depth = 3.5 / 16;
    const slope = profile.slope[Math.round(depth * (profile.slope.length - 1))]!;
    const t = shadeSurface(0, -1, slope, lightVector(-45, 18), 36);
    const lit = Math.min(1, 0.8 * (t.highlight + 0.45 * t.bounce) + 0.7 * t.rim);
    const dark = Math.min(1, 0.35 * t.shade) * (1 - lit);
    expect(px.glow[(y * px.width + x) * 4 + 3]! / 255).toBeCloseTo(lit + dark, 1);
  });
});

describe('fitRect', () => {
  const box = { x: 0, y: 0, width: 200, height: 100 };
  it('covers, keeping the aspect ratio and centering by default', () => {
    expect(fitRect(box, [100, 100], 'cover', '50% 50%')).toEqual({ x: 0, y: -50, width: 200, height: 200 });
  });
  it('contains', () => {
    expect(fitRect(box, [100, 100], 'contain', '50% 50%')).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });
  it('fills the box', () => {
    expect(fitRect(box, [100, 400], 'fill', '50% 50%')).toEqual(box);
  });
  it('follows object-position in keywords, percentages and px', () => {
    expect(fitRect(box, [100, 100], 'cover', '50% 93%').y).toBeCloseTo(-93);
    expect(fitRect(box, [100, 100], 'contain', 'left top')).toMatchObject({ x: 0, y: 0 });
    expect(fitRect(box, [100, 100], 'none', '10px 20px')).toMatchObject({ x: 10, y: 20, width: 100 });
  });
});

describe('the map worker', () => {
  class FakeWorker {
    static fail = false;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    postMessage(data: { id: number }) {
      setTimeout(() => {
        if (FakeWorker.fail) this.onerror?.(new Event('error'));
        else this.onmessage?.({ data: { id: data.id, displacement: 'data:image/png;base64,FROMWORKER', highlight: 'data:image/png;base64,LIGHT' } } as MessageEvent);
      });
    }
    terminate() {}
  }

  function Drops() {
    return (
      <GlassGroup data-testid="group">
        <Glass data-testid="a">A</Glass>
      </GlassGroup>
    );
  }

  async function drawn(container: HTMLElement) {
    const group = container.querySelector<HTMLElement>('[data-testid="group"]')!;
    place(group, { left: 0, top: 0, width: 200, height: 80 });
    place(container.querySelector<HTMLElement>('[data-testid="a"]')!, { left: 10, top: 10, width: 60, height: 40 });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        flushFrames(12);
        await new Promise((r) => setTimeout(r, 5));
      });
    }
    return group.querySelector<HTMLElement>('[data-meniscus-layer="surface"]')!;
  }

  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker);
    URL.createObjectURL = () => 'blob:fake';
    FakeWorker.fail = false;
  });

  it('builds the merged maps off the main thread when it can', async () => {
    overrideUnionWorker(true);
    mockSize(60, 40);
    const { container } = render(<Drops />);
    const surface = await drawn(container);
    expect(surface.style.maskImage).toContain('FROMWORKER');
  });

  it('falls back to the main thread when the worker fails', async () => {
    overrideUnionWorker(true);
    FakeWorker.fail = true;
    mockSize(60, 40);
    const { container } = render(<Drops />);
    const surface = await drawn(container);
    expect(surface.style.maskImage).toContain('data:image/png');
    expect(surface.style.maskImage).not.toContain('FROMWORKER');
  });
});

describe('backdrop fallbacks', () => {
  function Scene({ inside = false, mode }: { inside?: boolean; mode?: 'frost' }) {
    const behind = useRef<HTMLDivElement>(null);
    return (
      <div>
        <div ref={behind} data-testid="behind">
          {inside ? (
            <Glass data-testid="glass" backdrop={behind} mode={mode}>
              Hi
            </Glass>
          ) : null}
        </div>
        {inside ? null : (
          <Glass data-testid="glass" backdrop={behind} mode={mode}>
            Hi
          </Glass>
        )}
      </div>
    );
  }
  const glass = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-testid="glass"]')!;

  it('refracts a live copy of the backdrop where the browser can paint one', () => {
    overrideRefractionSupport(false);
    overrideElementCopy(true);
    overrideElementImage((id: string) => `url(#copy-${id})`);
    mockSize(160, 48);
    const { container } = render(<Scene />);
    act(() => flushFrames(2));
    const el = glass(container);
    expect(el.dataset.meniscus).toBe('element');
    expect(el.style.backgroundColor).toBe('transparent');
    const copy = el.querySelector<HTMLElement>('[data-meniscus-layer="copy"] > span')!;
    const behind = container.querySelector<HTMLElement>('[data-testid="behind"]')!;
    expect(behind.id).toMatch(/^meniscus-backdrop-/);
    expect(copy.style.backgroundImage).toContain(`#copy-${behind.id}`);
    expect(copy.style.filter).toMatch(/^url\(#meniscus-/);
    // The map sits inside the copy's margin.
    const corner = el.querySelector('feImage[result="tl"]')!;
    expect(corner.getAttribute('x')).toBe('16');
  });

  it('never copies an element that contains the glass', () => {
    overrideRefractionSupport(false);
    overrideElementCopy(true);
    mockSize(160, 48);
    const { container } = render(<Scene inside />);
    expect(glass(container).dataset.meniscus).toBe('frost');
  });

  it('ignores the backdrop where live refraction works, or when frost is asked for', () => {
    overrideElementCopy(true);
    mockSize(160, 48);
    overrideRefractionSupport(true);
    const live = render(<Scene />);
    expect(glass(live.container).dataset.meniscus).toBe('refract');
    live.unmount();
    overrideRefractionSupport(false);
    const forced = render(<Scene mode="frost" />);
    expect(glass(forced.container).dataset.meniscus).toBe('frost');
  });

  it('draws over media in WebGL, and frosts again if WebGL fails', async () => {
    overrideRefractionSupport(false);
    overrideWebGL2(true);
    mockSize(160, 48);
    function Photo() {
      const img = useRef<HTMLImageElement>(null);
      return (
        <div>
          <img ref={img} alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
          <GlassGroup data-testid="group" backdrop={img}>
            <Glass>A</Glass>
          </GlassGroup>
        </div>
      );
    }
    const { container } = render(<Photo />);
    const group = container.querySelector<HTMLElement>('[data-testid="group"]')!;
    expect(group.dataset.meniscusGroup).toBe('webgl');
    expect(group.querySelector('canvas[data-meniscus-layer="webgl"]')).not.toBeNull();
    // jsdom has no WebGL context: the renderer throws and the group frosts.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(group.dataset.meniscusGroup).toBe('frost');
  });
});

describe('resolveTint', () => {
  it('resolves a custom-property tint again after a theme switch', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const probe = vi.spyOn(window, 'getComputedStyle');
    resolveTint(el, 'var(--wash)');
    resolveTint(el, 'var(--wash)');
    expect(probe).toHaveBeenCalledTimes(1); // cached
    const before = tintVersion();
    document.documentElement.dataset.theme = 'dark';
    await new Promise((r) => setTimeout(r, 0));
    expect(tintVersion()).toBeGreaterThan(before);
    resolveTint(el, 'var(--wash)');
    expect(probe).toHaveBeenCalledTimes(2); // resolved against the new theme
    probe.mockRestore();
    delete document.documentElement.dataset.theme;
  });
});
