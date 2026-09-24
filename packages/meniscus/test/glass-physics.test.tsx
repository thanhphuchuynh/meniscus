// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { StrictMode, useLayoutEffect, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { Glass, useGlassPhysics } from '../src';
import { GlassPhysics, overrideRefractionSupport } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

function movable(el: HTMLElement, box = { left: 100, top: 100, width: 200, height: 80 }) {
  el.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => box }) as DOMRect;
  return box;
}

let frames: FrameRequestCallback[] = [];
let now = 1000;
let reduced = false;
function frame(count = 1) {
  for (let i = 0; i < count && frames.length; i++) {
    const run = frames;
    frames = [];
    now += 16;
    for (const f of run) f(now);
  }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    frames.push(f);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduced-motion'), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
});

afterEach(() => {
  cleanup();
  frame(400);
  frames = [];
  reduced = false;
  overrideRefractionSupport(undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const still = (initial: ConstructorParameters<typeof GlassPhysics>[0] extends infer O ? O extends { initial?: infer I } ? I : never : never) =>
  new GlassPhysics({ scheduler: 'manual', initial });

describe('useGlassPhysics', () => {
  it('keeps one instance, reconfigures it, and pauses it on unmount', () => {
    const seen: GlassPhysics[] = [];
    const pause = vi.spyOn(GlassPhysics.prototype, 'pause');
    function Probe({ physics }: { physics: 'snappy' | 'gentle' }) {
      seen.push(useGlassPhysics({ physics }));
      return null;
    }
    const { rerender, unmount } = render(<Probe physics="snappy" />);
    const configure = vi.spyOn(seen[0]!, 'configure');
    rerender(<Probe physics="gentle" />);
    expect(seen[1]).toBe(seen[0]);
    expect(configure).toHaveBeenCalledWith(expect.objectContaining({ physics: 'gentle' }));
    unmount();
    expect(pause).toHaveBeenCalled();
  });

  it('keeps a once-started transition through StrictMode’s doubled effects', () => {
    let physics: GlassPhysics | null = null;
    function Probe() {
      const p = useGlassPhysics({ initial: { presence: 0 } });
      physics = p;
      const once = useRef(false);
      // Like a layer's entrance: started once, in the layout phase.
      useLayoutEffect(() => {
        if (once.current) return;
        once.current = true;
        p.to({ presence: 1 }, { delay: 50 });
      }, [p]);
      return null;
    }
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    act(() => frame(200));
    expect(physics!.state.presence).toBe(1);
  });

  it('follows reduced motion', () => {
    reduced = true;
    let physics: GlassPhysics | null = null;
    function Probe() {
      physics = useGlassPhysics();
      return null;
    }
    render(<Probe />);
    physics!.to({ presence: 0 });
    expect(physics!.state.presence).toBe(0);
  });
});

describe('<Glass optics>', () => {
  it('writes the optics to the element and scales the refraction filter', () => {
    overrideRefractionSupport(true);
    mockSize(200, 80);
    const optics = still({ presence: 0.5, refraction: 0.5, tint: 0.4, shadow: 0.2, highlightX: 0.3, highlightY: -0.1 });
    const { container } = render(<Glass optics={optics}>x</Glass>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--meniscus-presence')).toBe('0.5');
    expect(el.style.getPropertyValue('--meniscus-opacity')).toBe('1');
    expect(el.style.getPropertyValue('--meniscus-tint')).toBe('0.4');
    expect(el.style.getPropertyValue('--meniscus-shadow')).toBe('0.2');
    expect(el.style.getPropertyValue('--meniscus-hx')).toBe('0.3');
    expect(el.style.getPropertyValue('--meniscus-hy')).toBe('-0.1');
    const map = el.querySelector('feDisplacementMap')!;
    expect(Number(map.getAttribute('scale'))).toBeCloseTo(Number(map.getAttribute('data-scale')) * 0.25, 3);
    expect(el.querySelector('[data-meniscus-layer="spot"]')).not.toBeNull();
  });

  it('reads presence, tint and lift in its styles, and leaves glass without optics untouched', () => {
    const optics = still({});
    const html = renderToString(<Glass optics={optics}>x</Glass>);
    expect(html).toContain('opacity:var(--meniscus-opacity, 1)');
    expect(html).toContain('var(--meniscus-tint, 1)');
    expect(html).toContain('var(--meniscus-shadow, 1)');
    expect(renderToString(<Glass>x</Glass>)).not.toContain('--meniscus');
  });

  it('fades text and glass together over the lower half of presence, so no text floats without its glass', () => {
    overrideRefractionSupport(true);
    mockSize(200, 80);
    const optics = still({ presence: 0.3 });
    const { container } = render(<Glass optics={optics}>x</Glass>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--meniscus-opacity')).toBe('0.4286');
    expect(el.style.getPropertyValue('--meniscus-presence')).toBe('0.3');
  });

  it('keeps a custom shadow', () => {
    const html = renderToString(
      <Glass optics={still({})} shadow="0 0 4px red">
        x
      </Glass>,
    );
    expect(html).toContain('box-shadow:0 0 4px red');
  });

  it('composes the app’s opacity with presence', () => {
    const html = renderToString(
      <Glass optics={still({})} style={{ opacity: 0.5 }}>
        x
      </Glass>,
    );
    expect(html).toContain('opacity:calc(var(--meniscus-opacity, 1) * 0.5)');
  });

  it('lifts on press and rings with the release', () => {
    overrideRefractionSupport(true);
    mockSize(200, 80);
    const optics = still({});
    const { getByTestId } = render(
      <Glass data-testid="g" optics={optics} interactive>
        x
      </Glass>,
    );
    const el = getByTestId('g');
    const box = movable(el);
    act(() => {
      fireEvent.pointerDown(el, { pointerId: 1, clientX: 150, clientY: 140 });
      frame();
    });
    for (let i = 0; i < 40; i++) optics.step(1 / 60);
    expect(optics.state.shadow).toBeGreaterThan(1.2);
    act(() => {
      for (let k = 0; k < 4; k++) {
        box.left += 40;
        frame();
      }
      fireEvent.pointerUp(el, { pointerId: 1 });
    });
    let peak = 1;
    for (let i = 0; i < 60; i++) {
      optics.step(1 / 60);
      peak = Math.max(peak, optics.state.refraction);
    }
    expect(peak).toBeGreaterThan(1.01);
  });

  it('lowers the lift again when the browser cancels a press', () => {
    overrideRefractionSupport(true);
    mockSize(200, 80);
    const optics = still({});
    const { getByTestId } = render(
      <Glass data-testid="g" optics={optics} interactive>
        x
      </Glass>,
    );
    const el = getByTestId('g');
    movable(el);
    act(() => {
      fireEvent.pointerDown(el, { pointerId: 1, clientX: 150, clientY: 140 });
      frame();
    });
    act(() => {
      fireEvent.pointerCancel(el, { pointerId: 1 });
    });
    for (let i = 0; i < 180; i++) optics.step(1 / 60);
    expect(optics.state.shadow).toBeCloseTo(1, 3);
  });

  it('cleans up on unmount', () => {
    overrideRefractionSupport(true);
    mockSize(200, 80);
    const optics = still({ presence: 0.5 });
    const { container, unmount } = render(<Glass optics={optics}>x</Glass>);
    const el = container.firstElementChild as HTMLElement;
    const seen: number[] = [];
    optics.subscribe((s) => seen.push(s.presence));
    unmount();
    expect(el.style.getPropertyValue('--meniscus-presence')).toBe('');
    optics.to({ presence: 1 });
    optics.step(1 / 60);
    expect(seen.length).toBeGreaterThan(1);
  });
});
