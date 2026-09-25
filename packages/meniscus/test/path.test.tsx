// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { Glass, GlassProvider, useGlassMode, type GlassPath, type GlassPathReason } from '../src';
import { overrideRefractionSupport } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

type Report = [GlassPath, GlassPathReason];

function reports() {
  const calls: Report[] = [];
  return { calls, onPathChange: (path: GlassPath, reason: GlassPathReason) => calls.push([path, reason]) };
}

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

beforeEach(() => {
  overrideRefractionSupport(true);
  mockSize(240, 56);
});

afterEach(() => {
  cleanup();
  overrideRefractionSupport(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('onPathChange', () => {
  it('reports refraction where the browser supports it, once', () => {
    const r = reports();
    const { rerender } = render(<Glass onPathChange={r.onPathChange}>Text</Glass>);
    rerender(<Glass onPathChange={r.onPathChange}>Text</Glass>);
    expect(r.calls).toEqual([['refract', 'supported']]);
  });

  it('names the engine when the browser cannot refract the page', () => {
    overrideRefractionSupport(false);
    const r = reports();
    render(<Glass onPathChange={r.onPathChange}>Text</Glass>);
    expect(r.calls).toEqual([['frost', 'engine']]);
  });

  it('names accessibility when reduced transparency frosts the glass, and useGlassMode agrees', () => {
    const r = reports();
    let mode: string | undefined;
    function Probe() {
      mode = useGlassMode();
      return null;
    }
    render(
      <GlassProvider reduceTransparency>
        <Glass onPathChange={r.onPathChange}>Text</Glass>
        <Probe />
      </GlassProvider>,
    );
    expect(r.calls).toEqual([['frost', 'accessibility']]);
    expect(mode).toBe('frost');
  });

  it('names a mode that asked for frost, and void elements', () => {
    const asked = reports();
    const input = reports();
    render(
      <>
        <Glass mode="frost" onPathChange={asked.onPathChange}>Text</Glass>
        <Glass as="input" aria-label="Search" onPathChange={input.onPathChange} />
      </>,
    );
    expect(asked.calls).toEqual([['frost', 'preference']]);
    expect(input.calls).toEqual([['frost', 'void']]);
  });

  it('keeps the prop off the DOM', () => {
    const { container } = render(<Glass onPathChange={() => {}}>Text</Glass>);
    expect(container.firstElementChild!.getAttribute('onpathchange')).toBeNull();
  });
});

describe('a confining ancestor', () => {
  it('stays quiet for glass inside glass, even faded glass, then warns once about a faded parent', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Glass style={{ opacity: 0.5 }}>
        <Glass>Nested</Glass>
      </Glass>,
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(warn).not.toHaveBeenCalled();
    cleanup();

    render(
      <div className="fade" style={{ opacity: 0.5 }}>
        <Glass>Text</Glass>
        <Glass>More</Glass>
      </div>,
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('<div class="fade"> (opacity: 0.5)');
  });
});
