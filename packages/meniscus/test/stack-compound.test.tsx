// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { forwardRef, useContext, useState, type ForwardedRef, type ReactElement } from 'react';
import type { LayerHandle } from '../src/react/stack';

// Record the handle each layer's glass receives, as the WebGL path would use it.
const handles = new Map<string, LayerHandle | null>();
vi.mock('../src/react/Glass', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/react/Glass')>();
  const { LayerContext } = await import('../src/react/stack');
  const Base = mod.Glass as unknown as (p: Record<string, unknown>) => ReactElement;
  const Recording = forwardRef(function Recording(props: Record<string, unknown>, ref: ForwardedRef<HTMLElement>) {
    const handle = useContext(LayerContext);
    if (typeof props['data-testid'] === 'string') handles.set(props['data-testid'], handle);
    return <Base {...props} ref={ref} />;
  });
  return { ...mod, Glass: Recording };
});

const { Glass } = await import('../src');

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  mockSize(200, 100);
  handles.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const belowOf = (id: string) => (handles.get(id)?.below() ?? []).map((p) => p.el.dataset.testid);

describe('stacked glass beneath a layer', () => {
  it('includes a lower layer that mounts after the rest', () => {
    function Late() {
      const [side, setSide] = useState(false);
      return (
        <>
          <button onClick={() => setSide(true)}>side</button>
          <Glass.Stack>
            {side ? (
              <Glass.Layer depth={1} data-testid="side">
                S
              </Glass.Layer>
            ) : null}
            <Glass.Layer depth={2} data-testid="card">
              C
            </Glass.Layer>
          </Glass.Stack>
        </>
      );
    }
    const { getByText } = render(<Late />);
    expect(belowOf('card')).toEqual([]);
    act(() => getByText('side').click());
    expect(belowOf('card')).toEqual(['side']);
  });

  it('keeps a lower layer that remounts', () => {
    function Rekey() {
      const [key, setKey] = useState(0);
      return (
        <>
          <button onClick={() => setKey((k) => k + 1)}>rekey</button>
          <Glass.Stack>
            <Glass.Layer key={key} depth={1} data-testid="side">
              S
            </Glass.Layer>
            <Glass.Layer depth={2} data-testid="card">
              C
            </Glass.Layer>
          </Glass.Stack>
        </>
      );
    }
    const { getByText } = render(<Rekey />);
    expect(belowOf('card')).toEqual(['side']);
    act(() => getByText('rekey').click());
    expect(belowOf('card')).toEqual(['side']);
  });
});
