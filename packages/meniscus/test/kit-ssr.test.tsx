import { renderToString } from 'react-dom/server';
import { GlassToaster, toast } from '../src';
import { Kit } from './fixtures/kit';

it('renders every kit component on the server, without a window', () => {
  expect(typeof window).toBe('undefined');
  const html = renderToString(<Kit />);
  expect(html).toContain('<dialog');
  expect(html).not.toMatch(/<dialog[^>]*\sopen/);
  expect(html).toContain('popover="manual"');
  expect(html).toContain('role="switch"');
  expect(html).toContain('type="range"');
  expect(html).toContain('type="radio"');
  expect(html).toContain('aria-label="Main"');
  expect(html).toContain('@media (max-width: 767.98px)');
});

it('keeps toast() out of server state', () => {
  expect(toast('Hello')).toMatch(/^meniscus-toast-/);
  expect(renderToString(<GlassToaster />)).not.toContain('Hello');
});
