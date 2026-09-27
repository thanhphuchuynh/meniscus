// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { dragDismisses, useDragDismiss, THROW } from '../src/react/drag';

afterEach(cleanup);

it('dismisses past the fraction of its size, or when thrown', () => {
  expect(dragDismisses(36, 0, 100, 0.35)).toBe(true);
  expect(dragDismisses(34, 0, 100, 0.35)).toBe(false);
  expect(dragDismisses(10, THROW + 1, 100, 0.35)).toBe(true);
  expect(dragDismisses(-50, -900, 100, 0.35)).toBe(false);
});

function Drawer({ onDismiss }: { onDismiss: () => void }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const drag = useDragDismiss(el, { axis: 'x', direction: -1, fraction: 0.35, enabled: true, reducedMotion: true, onDismiss });
  const ref = useCallback((n: HTMLDivElement | null) => {
    if (n) Object.defineProperty(n, 'offsetWidth', { configurable: true, value: 300 });
    setEl(n);
  }, []);
  return <div ref={ref} data-testid="drawer" {...drag} />;
}

it('follows the pointer toward its edge and dismisses past a third of its width', () => {
  const onDismiss = vi.fn();
  const { getByTestId } = render(<Drawer onDismiss={onDismiss} />);
  const drawer = getByTestId('drawer');
  fireEvent.pointerDown(drawer, { pointerId: 1, button: 0, clientX: 280 });
  fireEvent.pointerMove(drawer, { pointerId: 1, clientX: 200 });
  expect(drawer.style.getPropertyValue('--meniscus-drag')).toBe('-80px');
  fireEvent.pointerMove(drawer, { pointerId: 1, clientX: 160 });
  fireEvent.pointerUp(drawer, { pointerId: 1, clientX: 160 });
  expect(onDismiss).toHaveBeenCalledOnce();
});

it('resists the other way, ignores tiny moves, and settles back when released short', () => {
  const onDismiss = vi.fn();
  const { getByTestId } = render(<Drawer onDismiss={onDismiss} />);
  const drawer = getByTestId('drawer');
  fireEvent.pointerDown(drawer, { pointerId: 1, button: 0, clientX: 100 });
  fireEvent.pointerMove(drawer, { pointerId: 1, clientX: 103 });
  expect(drawer.style.getPropertyValue('--meniscus-drag')).toBe('');
  fireEvent.pointerMove(drawer, { pointerId: 1, clientX: 150 });
  expect(drawer.style.getPropertyValue('--meniscus-drag')).toBe('10px');
  fireEvent.pointerUp(drawer, { pointerId: 1, clientX: 150 });
  expect(onDismiss).not.toHaveBeenCalled();
  expect(drawer.style.getPropertyValue('--meniscus-drag')).toBe('0px');
});
