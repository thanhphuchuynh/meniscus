// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { Glass, type GlassPath, type GlassPathReason } from '../src';
import { overrideRefractionSupport } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

/** Puts every element `top` px down the page (the jsdom viewport is 768 px tall). */
function placeAt(top: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: top, left: 0, top, right: 240, bottom: top + 56, width: 240, height: 56, toJSON: () => ({}) });
}

const observed = new Map<Element, IntersectionObserverCallback>();
const idle: IdleRequestCallback[] = [];
const runIdle = () => act(() => idle.splice(0).forEach((cb) => cb({ didTimeout: false, timeRemaining: () => 50 })));
const scrollNear = (el: Element) => act(() => observed.get(el)?.([{ target: el, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

const maps = (el: Element) => ({ filter: !!el.querySelector('filter'), highlight: !!el.querySelector('[data-meniscus-layer="highlight"]') });

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) {
      observed.set(el, this.cb);
    }
    unobserve(el: Element) {
      observed.delete(el);
    }
    disconnect() {}
  };
  (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = (cb: IdleRequestCallback) => idle.push(cb);
});

afterAll(() => {
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
});

beforeEach(() => {
  overrideRefractionSupport(true);
  mockSize(240, 56);
});

afterEach(() => {
  cleanup();
  // Let the queue drain, so the next test starts with nothing scheduled.
  runIdle();
  overrideRefractionSupport(undefined);
});

describe('glass off screen', () => {
  it('builds its maps before it paints when it is on screen', () => {
    placeAt(120);
    const { container } = render(<Glass>Text</Glass>);
    expect(maps(container.firstElementChild!)).toEqual({ filter: true, highlight: true });
  });

  it('waits for idle time, reporting the path it settles on once', () => {
    placeAt(4000);
    const calls: Array<[GlassPath, GlassPathReason]> = [];
    const { container } = render(<Glass onPathChange={(p, r) => calls.push([p, r])}>Text</Glass>);
    const el = container.firstElementChild as HTMLElement;
    expect(maps(el)).toEqual({ filter: false, highlight: false });
    expect(el.dataset.meniscus).toBe('refract');
    runIdle();
    expect(maps(el)).toEqual({ filter: true, highlight: true });
    expect(calls).toEqual([['refract', 'supported']]);
  });

  it('builds at once when the page scrolls it near', () => {
    placeAt(4000);
    const { container } = render(<Glass>Text</Glass>);
    const el = container.firstElementChild as HTMLElement;
    scrollNear(el);
    expect(maps(el)).toEqual({ filter: true, highlight: true });
  });
});
