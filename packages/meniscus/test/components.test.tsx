// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { GlassButton, GlassCheckbox, GlassPanel, GlassSelect, GlassTabs, GlassTextField } from '../src';

afterEach(cleanup);

it('GlassButton keeps button semantics, disabled behavior, and a forwarded ref', () => {
  const ref = { current: null as HTMLButtonElement | null };
  const onClick = vi.fn();
  const { getByRole, rerender } = render(<GlassButton ref={ref} onClick={onClick}>Save</GlassButton>);
  const button = getByRole('button', { name: 'Save' }) as HTMLButtonElement;
  expect(ref.current).toBe(button);
  expect(button.type).toBe('button');
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  rerender(<GlassButton ref={ref} disabled onClick={onClick}>Save</GlassButton>);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});

it('GlassTabs supports keyboard selection with tab and panel semantics', () => {
  const { getByRole, queryByText } = render(
    <GlassTabs label="Library views" items={[
      { value: 'all', label: 'All', content: 'All items' },
      { value: 'saved', label: 'Saved', content: 'Saved items' },
      { value: 'recent', label: 'Recent', content: 'Recent items' },
    ]} />,
  );
  const first = getByRole('tab', { name: 'All' });
  const second = getByRole('tab', { name: 'Saved' });
  expect(first.getAttribute('aria-selected')).toBe('true');
  expect(queryByText('All items')).not.toBeNull();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(second.getAttribute('aria-selected')).toBe('true');
  expect(second).toBe(document.activeElement);
  expect(getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(second.id);
  expect(queryByText('All items')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);
  expect(queryByText('Saved items')).not.toBeNull();
  expect(document.getElementById(first.getAttribute('aria-controls')!)).not.toBeNull();
});

it('GlassTabs skips disabled tabs and reports controlled changes', () => {
  const onValueChange = vi.fn();
  const items = [
    { value: 'all', label: 'All', content: 'All items' },
    { value: 'draft', label: 'Draft', content: 'Draft items', disabled: true },
    { value: 'saved', label: 'Saved', content: 'Saved items' },
  ];
  const { getByRole, rerender } = render(<GlassTabs label="Views" items={items} value="all" onValueChange={onValueChange} />);
  fireEvent.keyDown(getByRole('tab', { name: 'All' }), { key: 'ArrowRight' });
  expect(onValueChange).toHaveBeenCalledWith('saved');
  rerender(<GlassTabs label="Views" items={items} value="saved" onValueChange={onValueChange} />);
  expect(getByRole('tab', { name: 'Saved' }).getAttribute('aria-selected')).toBe('true');
  expect(getByRole('tab', { name: 'Draft' }).hasAttribute('disabled')).toBe(true);
});

it('GlassPanel preserves the content and accessible label', () => {
  const { getByRole } = render(<GlassPanel role="region" aria-label="Account summary">Balance</GlassPanel>);
  expect(getByRole('region', { name: 'Account summary' }).textContent).toContain('Balance');
});

it('GlassTextField keeps native labeling, value changes, validation and ref', () => {
  const ref = { current: null as HTMLInputElement | null };
  const onChange = vi.fn();
  const { getByRole } = render(<GlassTextField ref={ref} label="Project name" name="project" required onChange={onChange} />);
  const input = getByRole('textbox', { name: 'Project name' }) as HTMLInputElement;
  expect(ref.current).toBe(input);
  expect(input.required).toBe(true);
  fireEvent.change(input, { target: { value: 'Atlas' } });
  expect(input.value).toBe('Atlas');
  expect(onChange).toHaveBeenCalledOnce();
});

it('GlassSelect keeps the native option and disabled behavior', () => {
  const { getByRole } = render(
    <GlassSelect label="Material" name="material" defaultValue="glass" disabled>
      <option value="glass">Glass</option>
      <option value="water">Water</option>
    </GlassSelect>,
  );
  const select = getByRole('combobox', { name: 'Material' }) as HTMLSelectElement;
  expect(select.value).toBe('glass');
  expect(select.disabled).toBe(true);
});

it('GlassCheckbox toggles through its label and submits a native value', () => {
  const { getByRole, getByText } = render(<GlassCheckbox name="alerts" value="yes" label="Send alerts" />);
  const checkbox = getByRole('checkbox', { name: 'Send alerts' }) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  fireEvent.click(getByText('Send alerts'));
  expect(checkbox.checked).toBe(true);
  expect(checkbox.value).toBe('yes');
});
