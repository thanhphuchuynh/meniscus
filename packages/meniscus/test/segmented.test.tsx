// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { GlassSegmented } from '../src';

const MEDIA = [
  { value: 'water', label: 'Water' },
  { value: 'glass', label: 'Glass' },
  { value: 'diamond', label: 'Diamond', disabled: true },
];

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('is a radio group in a fieldset, starting on the first enabled option', () => {
  const { getByRole } = render(<GlassSegmented label="Medium" options={MEDIA} />);
  expect(getByRole('group', { name: 'Medium' }).tagName).toBe('FIELDSET');
  expect((getByRole('radio', { name: 'Water' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(getByRole('radio', { name: 'Glass' }));
  expect((getByRole('radio', { name: 'Glass' }) as HTMLInputElement).checked).toBe(true);
});

it('reports choices, follows a controlled value, and submits under its name', () => {
  const onValueChange = vi.fn();
  const { getByRole, rerender, container } = render(
    <form>
      <GlassSegmented label="Medium" name="medium" options={MEDIA} value="water" onValueChange={onValueChange} />
    </form>,
  );
  fireEvent.click(getByRole('radio', { name: 'Glass' }));
  expect(onValueChange).toHaveBeenCalledWith('glass');
  expect((getByRole('radio', { name: 'Water' }) as HTMLInputElement).checked).toBe(true);
  rerender(
    <form>
      <GlassSegmented label="Medium" name="medium" options={MEDIA} value="glass" onValueChange={onValueChange} />
    </form>,
  );
  expect(new FormData(container.querySelector('form')!).get('medium')).toBe('glass');
});

it('disables options, and draws the selection in glass', () => {
  const { getByRole, container } = render(<GlassSegmented label="Medium" options={MEDIA} tint="rgba(255, 255, 255, 0.3)" />);
  expect((getByRole('radio', { name: 'Diamond' }) as HTMLInputElement).disabled).toBe(true);
  expect(container.querySelector('fieldset [data-meniscus]')).not.toBeNull();
});
