// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useContext, useState } from 'react';
import { Glass, GlassButton } from '../src';
import { overrideRefractionSupport, overrideWebGL2, springPeriod, staggerDelay } from '../src/core';
import { LayerContext } from '../src/react/stack';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

let frames: FrameRequestCallback[] = [];
let now = 1000;
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
  mockSize(200, 100);
});

afterEach(() => {
  cleanup();
  frame(400);
  frames = [];
  overrideRefractionSupport(undefined);
  overrideWebGL2(undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const presence = (el: HTMLElement) => Number(el.style.getPropertyValue('--meniscus-presence') || '1');

/** Frames until each element's presence first moves past 0.02 from `from`. */
function starts(els: HTMLElement[], from: number, limit = 200): number[] {
  const first = els.map(() => -1);
  for (let i = 0; i < limit; i++) {
    frame();
    els.forEach((el, k) => {
      if (first[k] === -1 && Math.abs(presence(el) - from) > 0.02) first[k] = i;
    });
  }
  return first;
}

function Pair({ stagger = 0.5, initial = false }: { stagger?: number; initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <>
      <button onClick={() => setOpen((o) => !o)}>toggle</button>
      <Glass.Stack physics="snappy" stagger={stagger}>
        <Glass.Layer depth={1} present={open} data-testid="side">
          S
        </Glass.Layer>
        <Glass.Layer depth={2} present={open} data-testid="card">
          C<GlassButton data-testid="inner">in</GlassButton>
        </Glass.Layer>
      </Glass.Stack>
    </>
  );
}

describe('<Glass.Stack>', () => {
  it('orders layers by depth and draws context layers as plain content', () => {
    const { getByTestId } = render(
      <Glass.Stack>
        <Glass.Layer kind="context" data-testid="scene">
          <p>Scene</p>
        </Glass.Layer>
        <Glass.Layer depth={2} data-testid="card">
          C
        </Glass.Layer>
        <Glass.Layer depth={1} data-testid="side">
          S
        </Glass.Layer>
      </Glass.Stack>,
    );
    expect(getByTestId('card').style.zIndex).toBe('2');
    expect(getByTestId('side').style.zIndex).toBe('1');
    expect(getByTestId('scene').dataset.meniscus).toBeUndefined();
    expect(getByTestId('card').dataset.meniscus).toBeDefined();
  });

  it('gives control layers the context media as their backdrop, as the renderer asks', () => {
    overrideWebGL2(true);
    const scene = (renderer?: 'auto' | 'css' | 'webgl') => (
      <Glass.Stack renderer={renderer}>
        <Glass.Layer kind="context">
          <img alt="" src={GIF} />
        </Glass.Layer>
        <Glass.Layer data-testid="c">C</Glass.Layer>
      </Glass.Stack>
    );
    overrideRefractionSupport(false);
    const safari = render(scene());
    expect(safari.getByTestId('c').dataset.meniscus).toBe('webgl');
    safari.unmount();
    const css = render(scene('css'));
    expect(css.getByTestId('c').dataset.meniscus).toBe('frost');
    css.unmount();
    overrideRefractionSupport(true);
    const chromium = render(scene());
    expect(chromium.getByTestId('c').dataset.meniscus).toBe('refract');
    chromium.unmount();
    const forced = render(scene('webgl'));
    expect(forced.getByTestId('c').dataset.meniscus).toBe('webgl');
  });

  it('staggers a shared transition by depth, nearest first', async () => {
    const { getByText, getByTestId } = render(<Pair />);
    await act(async () => {
      fireEvent.click(getByText('toggle'));
    });
    let first: number[] = [];
    act(() => {
      first = starts([getByTestId('side'), getByTestId('card')], 0);
    });
    const [side, card] = first;
    const expected = staggerDelay(1, 'snappy', 0.5) / 16;
    expect(card).toBeGreaterThanOrEqual(0);
    expect(Math.abs(side! - card! - expected)).toBeLessThanOrEqual(1.5);
  });

  it('reverses the order with a negative stagger', async () => {
    const { getByText, getByTestId } = render(<Pair stagger={-0.5} />);
    await act(async () => {
      fireEvent.click(getByText('toggle'));
    });
    let first: number[] = [];
    act(() => {
      first = starts([getByTestId('side'), getByTestId('card')], 0);
    });
    const [side, card] = first;
    expect(side!).toBeLessThan(card!);
  });

  it('reverses mid-transition without a jump', async () => {
    const { getByText, getByTestId } = render(<Pair stagger={0} />);
    await act(async () => {
      fireEvent.click(getByText('toggle'));
    });
    act(() => frame(5));
    const mid = presence(getByTestId('card'));
    await act(async () => {
      fireEvent.click(getByText('toggle'));
    });
    act(() => frame(1));
    expect(Math.abs(presence(getByTestId('card')) - mid)).toBeLessThan(0.15);
  });

  it('enters on mount with appear', async () => {
    const { getByTestId } = render(
      <Glass.Stack appear>
        <Glass.Layer data-testid="c">C</Glass.Layer>
      </Glass.Stack>,
    );
    expect(presence(getByTestId('c'))).toBe(0);
    await act(async () => {});
    act(() => frame(120));
    expect(presence(getByTestId('c'))).toBe(1);
  });

  it('hides absent layers from the page', () => {
    const { getByTestId } = render(<Pair />);
    expect(getByTestId('card').hasAttribute('inert')).toBe(true);
    expect(presence(getByTestId('card'))).toBe(0);
  });

  it('keeps glass inside a layer out of the stack', () => {
    let seen: unknown = 'unset';
    function Probe() {
      seen = useContext(LayerContext);
      return null;
    }
    const { getByTestId } = render(
      <Glass.Stack>
        <Glass.Layer data-testid="layer">
          <GlassButton data-testid="inner">in</GlassButton>
          <Probe />
        </Glass.Layer>
      </Glass.Stack>,
    );
    // The layer's own glass takes the handle and clears it for everything inside.
    expect(seen).toBeNull();
    expect(getByTestId('inner').style.getPropertyValue('--meniscus-presence')).toBe('');
    expect(getByTestId('layer').style.getPropertyValue('--meniscus-presence')).toBe('1');
  });

  it('unregisters layers that leave mid-transition', async () => {
    function Leaving() {
      const [open, setOpen] = useState(false);
      const [shown, setShown] = useState(true);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <button onClick={() => setShown(false)}>drop</button>
          <Glass.Stack stagger={0.5}>{shown ? <Glass.Layer present={open}>C</Glass.Layer> : null}</Glass.Stack>
        </>
      );
    }
    const { getByText } = render(<Leaving />);
    await act(async () => {
      fireEvent.click(getByText('open'));
    });
    act(() => frame(2));
    await act(async () => {
      fireEvent.click(getByText('drop'));
    });
    expect(() => act(() => frame(200))).not.toThrow();
    expect(frames.length).toBe(0);
  });

  it('warns once for a layer outside a stack, and once for a stack inside a layer', () => {
    render(
      <>
        <Glass.Layer>a</Glass.Layer>
        <Glass.Layer>b</Glass.Layer>
        <Glass.Stack>
          <Glass.Layer>
            <Glass.Stack>
              <Glass.Layer>c</Glass.Layer>
            </Glass.Stack>
          </Glass.Layer>
        </Glass.Stack>
      </>,
    );
    const calls = vi.mocked(console.warn).mock.calls.map(([m]) => String(m));
    expect(calls.filter((m) => m.includes('inside a <Glass.Stack>')).length).toBe(1);
    expect(calls.filter((m) => m.includes('inside a control layer')).length).toBe(1);
  });

  it('keeps the period arithmetic honest', () => {
    expect(staggerDelay(1, 'snappy', 0.5)).toBeCloseTo(0.5 * springPeriod('snappy') * 1000, 6);
  });
});
