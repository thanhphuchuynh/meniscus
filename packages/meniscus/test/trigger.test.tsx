// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { useTrigger } from '../src/react/trigger';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Host({ element, onOpen }: { element: ReactElement; onOpen: () => void }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const trigger = useTrigger(element, { 'aria-expanded': false, 'aria-describedby': 'tip', onClick: onOpen }, setNode);
  return <>{trigger}<output>{node ? node.tagName : 'none'}</output></>;
}

it('keeps the trigger’s own handler, label, ref and description, and adds its own', () => {
  const theirs = vi.fn();
  const ours = vi.fn();
  const ref = { current: null as HTMLButtonElement | null };
  const { getByRole, getByText } = render(
    <Host element={<button type="button" ref={ref} aria-label="Share plate" aria-describedby="hint" onClick={theirs}>Share</button>} onOpen={ours} />,
  );
  const button = getByRole('button', { name: 'Share plate' });
  fireEvent.click(button);
  expect(theirs).toHaveBeenCalledOnce();
  expect(ours).toHaveBeenCalledOnce();
  expect(theirs.mock.invocationCallOrder[0]!).toBeLessThan(ours.mock.invocationCallOrder[0]!);
  expect(ref.current).toBe(button);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(button.getAttribute('aria-describedby')).toBe('hint tip');
  expect(getByText('BUTTON')).not.toBeNull();
});

it('warns once when the trigger never gets a node', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  function Opaque(props: { children?: string }) {
    return <span>{props.children}</span>;
  }
  render(<Host element={<Opaque>Share</Opaque>} onOpen={() => {}} />);
  expect(warn).toHaveBeenCalledOnce();
  expect(warn.mock.calls[0]![0]).toContain('trigger');
});
