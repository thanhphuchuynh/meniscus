// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { GlassSidebar } from '../src';

function viewport(narrow: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('is a sticky glass column on wide screens, hidden by a media query below its breakpoint', () => {
  viewport(false);
  const { getByRole, container } = render(<GlassSidebar label="Library"><a href="#plates">Plates</a></GlassSidebar>);
  const aside = getByRole('complementary', { name: 'Library' });
  expect(aside.style.position).toBe('sticky');
  expect(container.querySelector('style')!.textContent).toContain('@media (max-width: 767.98px)');
  expect(container.querySelector('style')!.textContent).toContain(`[data-meniscus-sidebar="${aside.getAttribute('data-meniscus-sidebar')}"]`);
  expect(container.querySelector('dialog')).toBeNull();
});

it('server-renders its media rule as CSS a browser can read', () => {
  viewport(false);
  // React 18 escapes a <style>'s text like any other, which breaks the attribute selector's quotes.
  const css = /<style>(.*?)<\/style>/.exec(renderToString(<GlassSidebar label="Library">Plates</GlassSidebar>))![1];
  expect(css).toMatch(/\[data-meniscus-sidebar="[\w-]+"\]\{display:none!important\}/);
});

it('becomes a drawer on narrow screens, keeping its landmark inside', () => {
  viewport(true);
  const { container, getByRole, rerender } = render(
    <GlassSidebar label="Library" as="nav" open={false}>
      <a href="#plates">Plates</a>
    </GlassSidebar>,
  );
  const dialog = container.querySelector('dialog')!;
  expect(dialog.getAttribute('aria-label')).toBe('Library');
  expect(dialog.open).toBe(false);
  rerender(
    <GlassSidebar label="Library" as="nav" open>
      <a href="#plates">Plates</a>
    </GlassSidebar>,
  );
  expect(dialog.open).toBe(true);
  expect(getByRole('navigation', { name: 'Library' }).closest('dialog')).toBe(dialog);
});

it('never collapses with collapseBelow 0', () => {
  viewport(true);
  const { container } = render(<GlassSidebar label="Library" collapseBelow={0}>Links</GlassSidebar>);
  expect(container.querySelector('dialog')).toBeNull();
  expect(container.querySelector('style')).toBeNull();
});
