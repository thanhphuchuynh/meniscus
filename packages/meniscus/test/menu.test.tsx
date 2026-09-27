// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassMenu, type GlassMenuItem } from '../src';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

/** Runs the springs for about 1.5 s: long enough for any entrance or exit to finish. */
const settle = () => { for (let i = 0; i < 90; i++) act(() => { vi.advanceTimersByTime(16); }); };

function setup() {
  const chosen: string[] = [];
  const items: GlassMenuItem[] = [
    { label: 'Open', onSelect: () => chosen.push('open') },
    { label: 'Duplicate', shortcut: '⌘D', onSelect: () => chosen.push('duplicate') },
    'separator',
    { label: 'Delete', onSelect: () => chosen.push('delete'), disabled: true },
    { label: 'Details', onSelect: () => chosen.push('details') },
  ];
  const view = render(<GlassMenu label="Plate actions" trigger={<button type="button">Plate</button>} items={items} />);
  const trigger = view.getByRole('button', { name: 'Plate' });
  const focused = () => document.activeElement?.textContent;
  const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });
  return { ...view, trigger, chosen, focused, key };
}

it('is a menu button: ArrowDown opens on the first item, ArrowUp on the last', () => {
  const { trigger, getByRole, focused, key } = setup();
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  act(() => trigger.focus());
  key('ArrowDown');
  expect(getByRole('menu', { name: 'Plate actions' })).not.toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(focused()).toBe('Open');
  key('Escape');
  settle();
  expect(document.activeElement).toBe(trigger);
  key('ArrowUp');
  expect(focused()).toBe('Details');
});

it('moves with the arrows, skipping separators and disabled items, and wraps', () => {
  const { trigger, focused, key } = setup();
  fireEvent.click(trigger);
  expect(focused()).toBe('Open');
  key('ArrowDown');
  expect(focused()).toBe('Duplicate⌘D');
  key('ArrowDown');
  expect(focused()).toBe('Details');
  key('ArrowDown');
  expect(focused()).toBe('Open');
  key('ArrowUp');
  expect(focused()).toBe('Details');
  key('Home');
  expect(focused()).toBe('Open');
  key('End');
  expect(focused()).toBe('Details');
});

it('jumps to items by their first letter', () => {
  const { trigger, focused, key } = setup();
  fireEvent.click(trigger);
  key('d');
  expect(focused()).toBe('Duplicate⌘D');
  key('d');
  expect(focused()).toBe('Details');
  act(() => vi.advanceTimersByTime(600));
  key('o');
  expect(focused()).toBe('Open');
});

it('chooses an item, closes, and gives focus back', () => {
  const { trigger, getByRole, chosen } = setup();
  fireEvent.click(trigger);
  fireEvent.click(getByRole('menuitem', { name: /Duplicate/ }));
  expect(chosen).toEqual(['duplicate']);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  settle();
  expect(document.activeElement).toBe(trigger);
});

it('marks roles and disabled items, and never chooses a disabled one', () => {
  const { trigger, getAllByRole, getByRole, chosen } = setup();
  fireEvent.click(trigger);
  expect(getAllByRole('menuitem')).toHaveLength(4);
  expect(getAllByRole('separator')).toHaveLength(1);
  const remove = getByRole('menuitem', { name: 'Delete' });
  expect(remove.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(remove);
  expect(chosen).toEqual([]);
});

it('closes on Tab', () => {
  const { trigger, key } = setup();
  fireEvent.click(trigger);
  key('Tab');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('leaves a closed menu to the browser’s hidden popover style, so it takes no clicks', () => {
  const { trigger, getByRole } = setup();
  fireEvent.click(trigger);
  const menu = getByRole('menu', { name: 'Plate actions' });
  expect(getComputedStyle(menu).display).not.toBe('none');
  fireEvent.click(trigger);
  settle();
  expect(getComputedStyle(menu).display).toBe('none');
});
