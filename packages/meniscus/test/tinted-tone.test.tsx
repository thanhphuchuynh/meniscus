// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { Glass, GlassButton } from '../src';

// A tinted blue at 70%: dark on its own, lifted by a white page behind it.
vi.mock('../src/webgl/color', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/webgl/color')>()),
  resolveTint: () => [0.145, 0.388, 0.922, 0.7],
}));

let stack: Element[] = [];

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.elementsFromPoint = (() => stack) as unknown as typeof document.elementsFromPoint;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 120, height: 44, x: 0, y: 0, right: 120, bottom: 44, toJSON() {} } as DOMRect);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function behind(color: string) {
  const section = document.createElement('section');
  section.style.backgroundColor = color;
  document.body.appendChild(section);
  stack = [section];
}

it('takes its ink from its color over what is behind it', () => {
  behind('rgb(0, 0, 0)');
  const { container, unmount } = render(<Glass variant="tinted">Order</Glass>);
  expect(container.firstElementChild!.getAttribute('data-meniscus-tone')).toBe('dark');
  unmount();
  behind('rgb(255, 255, 255)');
  const light = render(<Glass variant="tinted">Order</Glass>);
  expect(light.container.firstElementChild!.getAttribute('data-meniscus-tone')).toBe('light');
});

it('inks the kit’s tinted controls, whose own color is only inherited', () => {
  behind('rgb(0, 0, 0)');
  const { getByRole } = render(<GlassButton variant="tinted">Order</GlassButton>);
  const button = getByRole('button', { name: 'Order' });
  expect(button.getAttribute('data-meniscus-tone')).toBe('dark');
  expect(button.style.color).toBe('var(--meniscus-ink-on-dark, #f7f8fa)');
});
