// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { Glass, GlassProvider, useGlassDefaults } from '../src';
import { glassHighlight, overrideRefractionSupport, resolveGlass } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

let frames: FrameRequestCallback[] = [];
function flushFrames(ms = 16, rounds = 400) {
  let now = performance.now();
  for (let i = 0; i < rounds && frames.length; i++) {
    const run = frames;
    frames = [];
    now += ms;
    for (const f of run) f(now);
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
});

describe('regressions found in review', () => {
  it('keeps an app’s own translate when interaction is off', () => {
    mockSize(200, 60);
    const { container } = render(<Glass style={{ translate: '-50% -50%' }}>x</Glass>);
    expect((container.firstElementChild as HTMLElement).style.translate).toBe('-50% -50%');
  });

  it('gives the app’s translate back once a press settles', () => {
    mockSize(200, 60);
    const { getByRole } = render(
      <Glass as="button" interactive style={{ translate: '-50% 0px' }}>
        x
      </Glass>,
    );
    const el = getByRole('button');
    act(() => {
      fireEvent.pointerDown(el, { clientX: 150, clientY: 30 });
      flushFrames(16, 20);
    });
    expect(el.style.translate).toContain('calc(-50%');
    act(() => {
      fireEvent.pointerUp(el);
      flushFrames();
    });
    expect(el.style.translate).toBe('-50% 0px');
    expect(el.style.scale).toBe('');
  });

  it('lets go of a press when interaction turns off mid-press', () => {
    mockSize(200, 60);
    function Busy() {
      const [busy, setBusy] = useState(false);
      return (
        <Glass as="button" interactive={!busy} onPointerDown={() => setBusy(true)}>
          x
        </Glass>
      );
    }
    const { getByRole } = render(<Busy />);
    const el = getByRole('button');
    act(() => {
      fireEvent.pointerDown(el, { clientX: 100, clientY: 30 });
      flushFrames();
    });
    expect(el.style.scale).toBe('');
  });

  it('renders void elements without throwing', () => {
    expect(() => renderToString(<Glass as="input" placeholder="Search" />)).not.toThrow();
    mockSize(200, 40);
    const { container } = render(<Glass as="input" placeholder="Search" />);
    expect(container.querySelector('input')?.getAttribute('placeholder')).toBe('Search');
  });

  it('passes through the cleanup a React 19 callback ref returns', () => {
    mockSize(100, 40);
    const cleanupFn = vi.fn();
    const refFn = vi.fn(() => cleanupFn);
    const { unmount } = render(<Glass ref={refFn}>x</Glass>);
    unmount();
    expect(cleanupFn).toHaveBeenCalledOnce();
    expect(refFn).not.toHaveBeenCalledWith(null);
  });

  it('does not let an undefined provider prop mask the parent', () => {
    let seen: unknown;
    function Probe() {
      seen = useGlassDefaults().tint;
      return null;
    }
    render(
      <GlassProvider tint="red">
        <GlassProvider tint={undefined} lightAngle={10}>
          <Probe />
        </GlassProvider>
      </GlassProvider>,
    );
    expect(seen).toBe('red');
  });

  it('keeps rim light when refraction is off', () => {
    const lit = glassHighlight(resolveGlass({ refraction: 0 }, 200, 80), 1);
    expect(lit).not.toBeNull();
    const onUrl = glassHighlight(resolveGlass({ refraction: 1 }, 200, 80), 1);
    expect(lit!.url).toBe(onUrl!.url); // the lit surface ignores optical strength
  });
});
