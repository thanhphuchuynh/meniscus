// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { Glass, GlassProvider, useGlassPreferences, type GlassPreferences } from '../src';
import { overrideRefractionSupport } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

/** jsdom has no matchMedia: give it one that matches these queries. */
function systemPrefers(...queries: string[]) {
  (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    matches: queries.includes(query),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
}

function Probe({ onRead }: { onRead: (p: GlassPreferences) => void }) {
  onRead(useGlassPreferences());
  return null;
}

const path = (container: HTMLElement) => (container.firstElementChild as HTMLElement).dataset.meniscus;
const edge = (container: HTMLElement) => container.querySelector('[data-meniscus-layer="edge"]');

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
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

describe('accessibility preferences', () => {
  it('refracts without an edge by default', () => {
    const { container } = render(<Glass>Text</Glass>);
    expect(path(container)).toBe('refract');
    expect(edge(container)).toBeNull();
  });

  it('draws opaque frost when a provider reduces transparency', () => {
    const { container } = render(
      <GlassProvider reduceTransparency>
        <Glass>Text</Glass>
      </GlassProvider>,
    );
    expect(path(container)).toBe('frost');
    expect(edge(container)).toBeNull();
  });

  it('drops refraction and draws a hairline edge under increased contrast', () => {
    const { container } = render(
      <GlassProvider increaseContrast>
        <Glass>Text</Glass>
      </GlassProvider>,
    );
    expect(path(container)).toBe('frost');
    expect(edge(container)).not.toBeNull();
  });

  it('follows the system, which a provider cannot switch off', () => {
    systemPrefers('(prefers-contrast: more)', '(prefers-reduced-motion: reduce)');
    let prefs: GlassPreferences | undefined;
    const { container } = render(
      <GlassProvider increaseContrast={false} reduceMotion={false}>
        <Glass>Text</Glass>
        <Probe onRead={(p) => (prefs = p)} />
      </GlassProvider>,
    );
    expect(edge(container)).not.toBeNull();
    expect(prefs).toEqual({ reducedTransparency: true, reducedMotion: true, increasedContrast: true });
  });

  it('asks each query once for the whole page, however many glasses render', () => {
    const asked: string[] = [];
    (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => {
      asked.push(query);
      return { matches: false, media: query, addEventListener() {}, removeEventListener() {} };
    };
    render(
      <>
        {[1, 2, 3, 4, 5].map((i) => (
          <Glass key={i}>Text</Glass>
        ))}
      </>,
    );
    expect(asked.length).toBeGreaterThan(0);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('keeps an edge in forced colors, where the system repaints it', () => {
    systemPrefers('(forced-colors: active)');
    const { container } = render(<Glass>Text</Glass>);
    expect(edge(container)).not.toBeNull();
  });
});
