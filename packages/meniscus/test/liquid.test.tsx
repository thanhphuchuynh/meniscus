// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Glass } from '../src';
import { MAX_SQUASH, squashMatrix, squashTarget } from '../src/react/liquid';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

/** A screen box the test moves; the element reports it as its rect. */
function movable(el: HTMLElement, box = { left: 100, top: 100, width: 200, height: 200 }) {
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
  frames = [];
  reduced = false;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('squash', () => {
  it('stretches along the velocity, shrinks across it, and keeps the area', () => {
    for (const [vx, vy] of [[1200, 0], [0, -800], [900, 900], [-300, 1700]] as const) {
      const [m11, m12, m21, m22] = squashMatrix(...squashTarget(vx, vy));
      expect(m11 * m22 - m12 * m21).toBeCloseTo(1, 9);
      const len = Math.hypot(vx, vy);
      const ux = vx / len;
      const uy = vy / len;
      const px = m11 * ux + m12 * uy;
      const py = m21 * ux + m22 * uy;
      expect(Math.hypot(px, py)).toBeGreaterThan(1);
      expect(px * uy - py * ux).toBeCloseTo(0, 9);
      const qx = m11 * -uy + m12 * ux;
      const qy = m21 * -uy + m22 * ux;
      expect(Math.hypot(qx, qy)).toBeLessThan(1);
    }
  });

  it('rests at the identity, ignores creeping motion, and stays within about 16%', () => {
    expect(squashMatrix(...squashTarget(0, 0))).toEqual([1, 0, 0, 1]);
    expect(squashTarget(60, 0)).toEqual([0, 0]);
    const [m11] = squashMatrix(...squashTarget(1e6, 0));
    expect(m11).toBeGreaterThan(1.15);
    expect(m11).toBeLessThanOrEqual(Math.sqrt((1 + MAX_SQUASH) / (1 - MAX_SQUASH)) + 1e-9);
  });
});

describe('a moving interactive glass', () => {
  function drag(el: HTMLElement, box: { left: number }, steps: number) {
    act(() => {
      fireEvent.pointerDown(el, { pointerId: 1, clientX: 200, clientY: 200 });
      frame();
      for (let k = 0; k < steps; k++) {
        box.left += 20;
        frame();
      }
    });
  }

  it('squashes while it moves and gives the transform back at rest', () => {
    mockSize(200, 200);
    const { getByTestId } = render(<Glass data-testid="g" interactive>x</Glass>);
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 6);
    expect(el.style.transform).toMatch(/^matrix\(/);
    const m11 = Number(el.style.transform.slice(7).split(',')[0]);
    expect(m11).toBeGreaterThan(1.01);
    act(() => {
      fireEvent.pointerUp(el, { pointerId: 1 });
      frame(200);
    });
    expect(el.style.transform).toBe('');
  });

  it('never squashes a glass that does not move', () => {
    mockSize(200, 200);
    const { getByTestId } = render(<Glass data-testid="g" interactive>x</Glass>);
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 0);
    act(() => frame(10));
    expect(el.style.transform).toBe('');
  });

  it('leaves a glass the app transforms alone', () => {
    mockSize(200, 200);
    const { getByTestId } = render(
      <Glass data-testid="g" interactive style={{ transform: 'rotate(4deg)' }}>
        x
      </Glass>,
    );
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 6);
    expect(el.style.transform).toBe('rotate(4deg)');
  });

  it('stops tracking when the pointer is cancelled mid-drag', () => {
    mockSize(200, 200);
    const { getByTestId } = render(<Glass data-testid="g" interactive>x</Glass>);
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 4);
    act(() => {
      fireEvent.pointerCancel(el, { pointerId: 1 });
      frame(200);
    });
    expect(el.style.transform).toBe('');
    // Tracking ended: nothing is left asking for frames.
    expect(frames.length).toBe(0);
  });

  it('does nothing under reduced motion', () => {
    reduced = true;
    mockSize(200, 200);
    const { getByTestId } = render(<Glass data-testid="g" interactive>x</Glass>);
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 6);
    expect(el.style.transform).toBe('');
  });
});
