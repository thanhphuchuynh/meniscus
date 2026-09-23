// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Glass, GlassProvider } from '../src';
import { overrideRefractionSupport } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

beforeAll(() => {
  // jsdom has no canvas; the encoder falls back to its own PNG writer.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  overrideRefractionSupport(undefined);
});

describe('<Glass> on the server', () => {
  it('renders frosted markup without touching the window', () => {
    const html = renderToString(
      <Glass radius="capsule" refraction={1.2} tint="rgba(0, 0, 0, 0.1)">
        Hello
      </Glass>,
    );
    expect(html).toContain('data-meniscus="frost"');
    expect(html).toContain('backdrop-filter:blur(5px) saturate(1.6)');
    expect(html).toContain('border-radius:9999px');
    expect(html).not.toMatch(/refraction=|radius=|tint=/);
    expect(html).not.toContain('<filter');
  });
});

describe('<Glass> in the browser', () => {
  it('switches to refraction after mount where supported', () => {
    overrideRefractionSupport(true);
    mockSize(240, 56);
    const { container } = render(<Glass radius="capsule">Tab</Glass>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.meniscus).toBe('refract');
    const filter = el.querySelector('filter');
    expect(filter).not.toBeNull();
    expect(el.style.backdropFilter).toContain(`url(#${filter!.id})`);
    expect(el.style.borderRadius).toBe('28px');
    expect(el.querySelectorAll('feImage')).toHaveLength(6); // capsule: no side strips
  });

  it('stays frosted where refraction is unsupported', () => {
    overrideRefractionSupport(false);
    mockSize(240, 56);
    const { container } = render(<Glass>Tab</Glass>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.meniscus).toBe('frost');
    expect(el.querySelector('filter')).toBeNull();
    expect(el.querySelector('[data-meniscus-layer="highlight"]')).not.toBeNull();
  });

  it('honors a forced mode from the provider', () => {
    overrideRefractionSupport(true);
    mockSize(200, 120);
    const { container } = render(
      <GlassProvider mode="frost">
        <Glass>Card</Glass>
      </GlassProvider>,
    );
    expect((container.firstElementChild as HTMLElement).dataset.meniscus).toBe('frost');
  });

  it('renders the requested element and passes DOM props through', () => {
    mockSize(120, 44);
    const onClick = vi.fn();
    const { getByRole } = render(
      <Glass as="button" type="button" aria-label="Play" onClick={onClick} interactive>
        ▶
      </Glass>,
    );
    const button = getByRole('button', { name: 'Play' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.querySelector('[data-meniscus-layer="glow"]')).not.toBeNull();
    act(() => button.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('adds channel splitting to the filter when aberration is on', () => {
    overrideRefractionSupport(true);
    mockSize(300, 200);
    const { container } = render(<Glass aberration={0.5}>Card</Glass>);
    expect(container.querySelectorAll('feDisplacementMap')).toHaveLength(3);
  });
});
