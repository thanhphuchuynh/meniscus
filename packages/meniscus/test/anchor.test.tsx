// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { overrideAnchorPositioning } from '../src/core';
import { useAnchor } from '../src/react/anchor';

function rect(r: { left: number; top: number; width: number; height: number }) {
  return () => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r }) as DOMRect;
}

afterEach(() => {
  cleanup();
  overrideAnchorPositioning(false);
  vi.useRealTimers();
});

function Harness({ active }: { active: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<HTMLElement | null>(null);
  const style = useAnchor(anchor, box, active, { placement: 'bottom', offset: 8 });
  // Stable callback refs: an inline one that sets state would run, and re-render, on every render.
  const anchorRef = useCallback((el: HTMLButtonElement | null) => {
    if (el) el.getBoundingClientRect = rect({ left: 100, top: 50, width: 80, height: 30 });
    setAnchor(el);
  }, []);
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 120 });
      Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 60 });
    }
    setBox(el);
  }, []);
  return (
    <>
      <button ref={anchorRef}>Open</button>
      <div ref={boxRef} data-testid="box" style={style} />
    </>
  );
}

it('places the box with place() while active, and again on scroll', () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const { getByTestId, getByText, rerender } = render(<Harness active={false} />);
  rerender(<Harness active />);
  const box = getByTestId('box');
  expect(box.style.position).toBe('fixed');
  expect(box.style.left).toBe('80px');
  expect(box.style.top).toBe('88px');
  expect(box.getAttribute('data-placement')).toBe('bottom');
  getByText('Open').getBoundingClientRect = rect({ left: 100, top: 20, width: 80, height: 30 });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(16);
  });
  expect(box.style.top).toBe('58px');
});

it('hands positioning to CSS where anchor positioning exists', () => {
  overrideAnchorPositioning(true);
  const anchor = document.createElement('button');
  const { result } = renderHook(() => useAnchor(anchor, null, true, { placement: 'bottom-start', offset: 6 }));
  const style = result.current as Record<string, unknown>;
  expect(style.positionArea).toBe('bottom span-right');
  expect(style.positionTryFallbacks).toBe('flip-block, flip-inline');
  expect(style.marginTop).toBe(6);
  expect(String(style.positionAnchor)).toMatch(/^--meniscus-anchor-/);
  expect(anchor.style.getPropertyValue('anchor-name')).toBe(style.positionAnchor);
});
